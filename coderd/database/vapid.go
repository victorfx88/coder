package database

import (
	"context"
	"database/sql"

	"golang.org/x/xerrors"
)

// Key names for the properties table
const (
	// VAPIDPublicKey is the public key used for web push notifications
	VAPIDPublicKey = "vapid_public_key"
	// VAPIDPrivateKey is the private key used for web push notifications
	VAPIDPrivateKey = "vapid_private_key"
)

// GetVAPIDPublicKey retrieves the VAPID public key from the database
func (q *sqlQuerier) GetVAPIDPublicKey(ctx context.Context) (string, error) {
	row, err := q.db.QueryContext(ctx, "SELECT value FROM properties WHERE name = $1", VAPIDPublicKey)
	if err != nil {
		return "", xerrors.Errorf("query VAPID public key: %w", err)
	}
	defer row.Close()

	if !row.Next() {
		return "", sql.ErrNoRows
	}

	var value string
	err = row.Scan(&value)
	if err != nil {
		return "", xerrors.Errorf("scan VAPID public key: %w", err)
	}

	return value, nil
}

// GetVAPIDPrivateKey retrieves the VAPID private key from the database
func (q *sqlQuerier) GetVAPIDPrivateKey(ctx context.Context) (string, error) {
	row, err := q.db.QueryContext(ctx, "SELECT value FROM properties WHERE name = $1", VAPIDPrivateKey)
	if err != nil {
		return "", xerrors.Errorf("query VAPID private key: %w", err)
	}
	defer row.Close()

	if !row.Next() {
		return "", sql.ErrNoRows
	}

	var value string
	err = row.Scan(&value)
	if err != nil {
		return "", xerrors.Errorf("scan VAPID private key: %w", err)
	}

	return value, nil
}

// InsertVAPIDPublicKey inserts the VAPID public key into the database
func (q *sqlQuerier) InsertVAPIDPublicKey(ctx context.Context, publicKey string) error {
	_, err := q.db.ExecContext(ctx, "INSERT INTO properties (name, value) VALUES ($1, $2)", VAPIDPublicKey, publicKey)
	if err != nil {
		return xerrors.Errorf("insert VAPID public key: %w", err)
	}
	return nil
}

// InsertVAPIDPrivateKey inserts the VAPID private key into the database
func (q *sqlQuerier) InsertVAPIDPrivateKey(ctx context.Context, privateKey string) error {
	_, err := q.db.ExecContext(ctx, "INSERT INTO properties (name, value) VALUES ($1, $2)", VAPIDPrivateKey, privateKey)
	if err != nil {
		return xerrors.Errorf("insert VAPID private key: %w", err)
	}
	return nil
}