package db

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool wraps a pgx pool. Every tenant-scoped query MUST go through
// WithTenant, which sets the Postgres session variable app.tenant_id
// that the RLS policies (see migrations/0001_init.sql) key off of.
// Never hand out the raw pool to service code for tenant tables.
type Pool struct {
	*pgxpool.Pool
}

func Open(ctx context.Context, databaseURL string) (*Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("db: ping: %w", err)
	}
	return &Pool{pool}, nil
}

// WithTenant runs fn inside a transaction that has app.tenant_id set for
// the current Postgres session, activating row-level security for every
// statement fn executes. This is the ONLY sanctioned way to touch
// tenant-scoped tables (orders, products, uploads, ...).
func (p *Pool) WithTenant(ctx context.Context, tenantID uuid.UUID, fn func(ctx context.Context, tx TxLike) error) error {
	tx, err := p.Begin(ctx)
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

// WithSystem runs fn in a transaction with no tenant context, for
// operations that legitimately span tenants (super-admin queries,
// tenant creation, cron jobs). RLS policies must explicitly allow the
// "system" role/bypass path for these to succeed — see migrations.
func (p *Pool) WithSystem(ctx context.Context, fn func(ctx context.Context, tx TxLike) error) error {
	tx, err := p.Begin(ctx)
	if err != nil {
		return fmt.Errorf("db: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if err := fn(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
