package middleware

import (
	"net/http"
	"sync"

	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
	"golang.org/x/time/rate"
)

// RateLimit throttles requests per tenant so one noisy client can't
// starve the others on a single shared VPS. Limiters are created
// lazily and kept in memory — fine for a single-instance modulith;
// swap for a Redis-backed limiter if this ever runs on multiple nodes.
type RateLimit struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
	rps      rate.Limit
	burst    int
}

func NewRateLimit(rps float64, burst int) *RateLimit {
	return &RateLimit{
		limiters: make(map[string]*rate.Limiter),
		rps:      rate.Limit(rps),
		burst:    burst,
	}
}

func (r *RateLimit) limiterFor(key string) *rate.Limiter {
	r.mu.Lock()
	defer r.mu.Unlock()
	l, ok := r.limiters[key]
	if !ok {
		l = rate.NewLimiter(r.rps, r.burst)
		r.limiters[key] = l
	}
	return l
}

func (r *RateLimit) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		key := req.RemoteAddr
		if t, ok := TenantFromContext(req.Context()); ok {
			key = t.ID.String()
		}
		if !r.limiterFor(key).Allow() {
			response.Err(w, apierror.ErrRateLimited)
			return
		}
		next.ServeHTTP(w, req)
	})
}
