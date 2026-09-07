package middleware

import (
	"net/http"
	"sync"

	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
	"golang.org/x/time/rate"
)

// RateLimit throttles requests per tenant so one noisy client can't
// starve the others on a single shared VPS. Each tenant's own
// rate_limit_per_sec/rate_limit_burst (set from the super-admin
// dashboard's Tenants page, per plan) drives its limiter — a limiter is
// rebuilt whenever those values change so an admin update takes effect
// on the tenant's very next request. Limiters are kept in memory — fine
// for a single-instance modulith; swap for a Redis-backed limiter if this
// ever runs on multiple nodes.
type RateLimit struct {
	mu       sync.Mutex
	limiters map[string]*tenantLimiter

	defaultRPS   rate.Limit
	defaultBurst int
}

type tenantLimiter struct {
	limiter *rate.Limiter
	rps     int
	burst   int
}

func NewRateLimit(defaultRPS float64, defaultBurst int) *RateLimit {
	return &RateLimit{
		limiters:     make(map[string]*tenantLimiter),
		defaultRPS:   rate.Limit(defaultRPS),
		defaultBurst: defaultBurst,
	}
}

func (r *RateLimit) limiterFor(key string, rps, burst int) *rate.Limiter {
	r.mu.Lock()
	defer r.mu.Unlock()

	tl, ok := r.limiters[key]
	if !ok || tl.rps != rps || tl.burst != burst {
		tl = &tenantLimiter{
			limiter: rate.NewLimiter(rate.Limit(rps), burst),
			rps:     rps,
			burst:   burst,
		}
		r.limiters[key] = tl
	}
	return tl.limiter
}

func (r *RateLimit) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		key := req.RemoteAddr
		rps, burst := int(r.defaultRPS), r.defaultBurst

		if t, ok := TenantFromContext(req.Context()); ok {
			key = t.ID.String()
			if t.RateLimitPerSec > 0 {
				rps = t.RateLimitPerSec
			}
			if t.RateLimitBurst > 0 {
				burst = t.RateLimitBurst
			}
		}

		if !r.limiterFor(key, rps, burst).Allow() {
			MarkRateLimited(req)
			response.Err(w, apierror.ErrRateLimited)
			return
		}
		next.ServeHTTP(w, req)
	})
}
