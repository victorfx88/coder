package appearance

import (
	"context"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/codersdk"
)

type Fetcher interface {
	Fetch(ctx context.Context) (codersdk.AppearanceConfig, error)
}

// Config returns a wrapper function to ensure that all appearance fetches
// for a process use the same config. This is utilized in agentapi.
func Config(fetcher Fetcher) (*Fetcher, error) {
	if fetcher == nil {
		return nil, xerrors.New("no appearance fetcher provided")
	}
	return &fetcher, nil
}

// BannerDismisser provides an interface to dismiss announcement banners.
type BannerDismisser interface {
	// DismissBanner dismisses an announcement banner for a specific user.
	DismissBanner(ctx context.Context, userID string, message string) error
}

type AGPLFetcher struct {
	docsURL string
}

func (f AGPLFetcher) Fetch(context.Context) (codersdk.AppearanceConfig, error) {
	return codersdk.AppearanceConfig{
		AnnouncementBanners: []codersdk.BannerConfig{},
		SupportLinks:        codersdk.DefaultSupportLinks(f.docsURL),
		DocsURL:             f.docsURL,
	}, nil
}

func NewDefaultFetcher(docsURL string) Fetcher {
	if docsURL == "" {
		docsURL = codersdk.DefaultDocsURL()
	}
	return &AGPLFetcher{
		docsURL: docsURL,
	}
}
