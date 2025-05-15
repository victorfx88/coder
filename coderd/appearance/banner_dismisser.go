package appearance

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/coderd/database"
)

// DatabaseBannerDismisser implements BannerDismisser using the database.
type DatabaseBannerDismisser struct {
	db database.Store
}

// Helper function to parse UUID from string
func parseUUID(id string) (uuid.UUID, error) {
	return uuid.Parse(id)
}

// NewDatabaseBannerDismisser creates a new DatabaseBannerDismisser.
func NewDatabaseBannerDismisser(db database.Store) *DatabaseBannerDismisser {
	return &DatabaseBannerDismisser{
		db: db,
	}
}

// DismissBanner dismisses an announcement banner for a specific user.
func (d *DatabaseBannerDismisser) DismissBanner(ctx context.Context, userID string, message string) error {
	if message == "" {
		return xerrors.New("message is required")
	}

	// Create a hash of the message to use as a unique identifier for the banner
	messageHash := hashMessage(message)

	// Store the dismissed state in the user_configs table
	key := fmt.Sprintf("dismissed_announcement_banner_%s", messageHash)
	value := time.Now().UTC().Format(time.RFC3339)

	return d.storeDismissedBanner(ctx, userID, key, value)
}

// Helper function to create a hash of the message for unique identification
func hashMessage(message string) string {
	h := sha256.New()
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}

// Helper function to store a dismissed banner in the database
func (d *DatabaseBannerDismisser) storeDismissedBanner(ctx context.Context, userID, key, value string) error {
	// Check if the user exists
	userUUID, err := parseUUID(userID)
	if err != nil {
		return xerrors.Errorf("invalid user ID: %w", err)
	}

	// Use a transaction to execute the SQL query
	return d.db.InTx(func(db database.Store) error {
		query := `
			INSERT INTO user_configs (user_id, key, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, key) DO UPDATE SET value = $3
		`
		
		// The txquerier has DBTX methods available on it directly
		tx := db.(interface{
			ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
		})

		_, err := tx.ExecContext(ctx, query, userUUID, key, value)
		return err
	}, nil)
}

// GetDismissedBannersByUser returns all dismissed banners for a user.
func (d *DatabaseBannerDismisser) GetDismissedBannersByUser(ctx context.Context, userID string) (map[string]string, error) {
	userUUID, err := parseUUID(userID)
	if err != nil {
		return nil, xerrors.Errorf("invalid user ID: %w", err)
	}

	dismissed := make(map[string]string)
	
	// Use a transaction to execute the SQL query
	err = d.db.InTx(func(db database.Store) error {
		query := "SELECT key, value FROM user_configs WHERE user_id = $1 AND key LIKE 'dismissed_announcement_banner_%'"
		
		// The txquerier has DBTX methods available on it directly
		tx := db.(interface{
			QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
		})
		
		rows, err := tx.QueryContext(ctx, query, userUUID)
		if err != nil {
			return err
		}
		defer rows.Close()
		
		for rows.Next() {
			var key, value string
			if err := rows.Scan(&key, &value); err != nil {
				return err
			}
			dismissed[key] = value
		}
		
		return rows.Err()
	}, nil)
	
	if err != nil {
		return nil, err
	}
	
	return dismissed, nil
}