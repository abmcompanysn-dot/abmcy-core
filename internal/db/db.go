package db

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool holds two separate underlying connections: appPool (connects as
// abmcy_app, a normal role with no RLS bypass — used by WithTenant, so
// every tenant-scoped statement is actually constrained by row-level
// security) and systemPool (connects as abmcy_system, which has the
// BYPASSRLS attribute — used by WithSystem, for operations that
// legitimately span tenants: super-admin queries, tenant creation, cron
// jobs). Splitting these into two roles/connections — rather than relying
// on table ownership or a superuser role — is what makes RLS a real
// security boundary instead of a no-op enforced only by application code
// discipline. See migrations/0009_real_rls_isolation.sql for the
// corresponding database-side setup.
type Pool struct {
	appPool    *pgxpool.Pool
	systemPool *pgxpool.Pool
}

// Open connects both pools. appDatabaseURL must authenticate as a role
// WITHOUT BYPASSRLS or SUPERUSER (abmcy_app); systemDatabaseURL must
// authenticate as a role WITH BYPASSRLS (abmcy_system, itself not
// SUPERUSER — a compromised app should never be able to escalate further
// than "sees every tenant's rows", not "can do literally anything").
func Open(ctx context.Context, appDatabaseURL, systemDatabaseURL string) (*Pool, error) {
	appPool, err := pgxpool.New(ctx, appDatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: connect app pool: %w", err)
	}
	if err := appPool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("db: ping app pool: %w", err)
	}

	systemPool, err := pgxpool.New(ctx, systemDatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: connect system pool: %w", err)
	}
	if err := systemPool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("db: ping system pool: %w", err)
	}

	return &Pool{appPool: appPool, systemPool: systemPool}, nil
}

func (p *Pool) Close() {
	p.appPool.Close()
	p.systemPool.Close()
}

// WithTenant runs fn inside a transaction — on the app connection, which
// cannot bypass row-level security — that has app.tenant_id set for the
// current Postgres session. This is the ONLY sanctioned way to touch
// tenant-scoped tables (orders, products, uploads, ...).
func (p *Pool) WithTenant(ctx context.Context, tenantID uuid.UUID, fn func(ctx context.Context, tx TxLike) error) error {
	tx, err := p.appPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("db: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// set_config(..., true) scopes the setting to the current transaction only,
	// so it can never leak onto a pooled connection reused by another tenant.
	if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID.String()); err != nil {
		return fmt.Errorf("db: set tenant context: %w", err)
	}

	if err := fn(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("db: commit: %w", err)
	}
	return nil
}

// WithSystem runs fn in a transaction on the system connection (BYPASSRLS),
// for operations that legitimately span tenants (super-admin queries,
// tenant creation, cron jobs).
func (p *Pool) WithSystem(ctx context.Context, fn func(ctx context.Context, tx TxLike) error) error {
	tx, err := p.systemPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("db: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if err := fn(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
