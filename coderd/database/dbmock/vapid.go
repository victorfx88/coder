package dbmock

import (
	"context"
)

// GetVAPIDPublicKey implements database.Store
func (m *MockStore) GetVAPIDPublicKey(ctx context.Context) (string, error) {
	return "", nil
}

// GetVAPIDPrivateKey implements database.Store
func (m *MockStore) GetVAPIDPrivateKey(ctx context.Context) (string, error) {
	return "", nil
}

// InsertVAPIDPublicKey implements database.Store
func (m *MockStore) InsertVAPIDPublicKey(ctx context.Context, publicKey string) error {
	return nil
}

// InsertVAPIDPrivateKey implements database.Store
func (m *MockStore) InsertVAPIDPrivateKey(ctx context.Context, privateKey string) error {
	return nil
}