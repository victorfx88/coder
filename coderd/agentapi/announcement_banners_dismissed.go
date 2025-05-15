package agentapi

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/agent/proto"
	"github.com/coder/coder/v2/coderd/database"
)

// DismissAnnouncementBanner dismisses a specific announcement banner for the requesting user.
// It stores the dismissed state in the user_configs table.
func (a *AnnouncementBannerAPI) DismissAnnouncementBanner(
	ctx context.Context, 
	req *proto.DismissAnnouncementBannerRequest,
	db database.Store,
	userID string,
) (*proto.DismissAnnouncementBannerResponse, error) {
	if req.Message == "" {
		return nil, xerrors.New("message is required")
	}

	// Create a hash of the message to use as a unique identifier for the banner
	messageHash := hashMessage(req.Message)

	// Store the dismissed state in the user_configs table
	key := fmt.Sprintf("dismissed_announcement_banner_%s", messageHash)
	value := time.Now().UTC().Format(time.RFC3339)

	err := storeDismissedBanner(ctx, db, userID, key, value)
	if err != nil {
		return nil, xerrors.Errorf("failed to store dismissed banner: %w", err)
	}

	return &proto.DismissAnnouncementBannerResponse{
		Dismissed: true,
	}, nil
}

// Get announcement banners that are not dismissed by the user.
// This extends the existing GetAnnouncementBanners to filter out dismissed banners.
func (a *AnnouncementBannerAPI) GetFilteredAnnouncementBanners(
	ctx context.Context, 
	req *proto.GetAnnouncementBannersRequest,
	db database.Store,
	userID string,
) (*proto.GetAnnouncementBannersResponse, error) {
	// Get all announcement banners
	cfg, err := (*a.appearanceFetcher.Load()).Fetch(ctx)
	if err != nil {
		return nil, xerrors.Errorf("fetch appearance: %w", err)
	}

	// Get all dismissed banners for this user
	dismissedBanners, err := getDismissedBannersByUser(ctx, db, userID)
	if err != nil {
		return nil, xerrors.Errorf("fetch dismissed banners: %w", err)
	}

	// Filter out dismissed banners and non-dismissible ones
	banners := make([]*proto.BannerConfig, 0, len(cfg.AnnouncementBanners))
	for _, banner := range cfg.AnnouncementBanners {
		// Skip if this banner is not enabled
		if !banner.Enabled {
			continue
		}

		// Check if this banner can be dismissed
		if !banner.Dismissible {
			// If it's not dismissible, always show it
			banners = append(banners, agentsdk.ProtoFromBannerConfig(banner))
			continue
		}

		// Check if this banner has been dismissed
		messageHash := hashMessage(banner.Message)
		key := fmt.Sprintf("dismissed_announcement_banner_%s", messageHash)
		if _, ok := dismissedBanners[key]; ok {
			// This banner has been dismissed, skip it
			continue
		}

		// If we got here, the banner is not dismissed and should be shown
		banners = append(banners, agentsdk.ProtoFromBannerConfig(banner))
	}

	return &proto.GetAnnouncementBannersResponse{
		AnnouncementBanners: banners,
	}, nil
}

// Helper function to create a hash of the message for unique identification
func hashMessage(message string) string {
	h := sha256.New()
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}

// Helper function to store a dismissed banner in the database
func storeDismissedBanner(ctx context.Context, db database.Store, userID, key, value string) error {
	// Check if the user exists
	userUUID, err := parseUUID(userID)
	if err != nil {
		return xerrors.Errorf("invalid user ID: %w", err)
	}

	// Using raw SQL since we don't have a generated query for this
	_, err = db.ExecContext(ctx, 
		"INSERT INTO user_configs (user_id, key, value) VALUES ($1, $2, $3) "+
		"ON CONFLICT (user_id, key) DO UPDATE SET value = $3",
		userUUID, key, value)
	
	return err
}

// Helper function to get all dismissed banners for a user
func getDismissedBannersByUser(ctx context.Context, db database.Store, userID string) (map[string]string, error) {
	userUUID, err := parseUUID(userID)
	if err != nil {
		return nil, xerrors.Errorf("invalid user ID: %w", err)
	}

	// Query for all dismissed banners keys
	rows, err := db.QueryContext(ctx, 
		"SELECT key, value FROM user_configs WHERE user_id = $1 AND key LIKE 'dismissed_announcement_banner_%'",
		userUUID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	dismissed := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		dismissed[key] = value
	}
	
	return dismissed, rows.Err()
}

// Helper function to parse UUID from string
func parseUUID(id string) (database.UUID, error) {
	var uuid database.UUID
	err := uuid.UnmarshalText([]byte(id))
	if err != nil {
		return uuid, err
	}
	return uuid, nil
}