package idpsync_test

import (
	"testing"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"cdr.dev/slog/sloggers/slogtest"
	"github.com/coder/coder/v2/coderd/idpsync"
	"github.com/coder/coder/v2/coderd/runtimeconfig"
	"github.com/coder/coder/v2/testutil"
)

func TestFromLegacySettings(t *testing.T) {
	t.Run("AssignDefault,True", func(t *testing.T) {
		legacy := `{
   "Field":"groups",
   "Mapping":{
      "engineering":[
         "10b2bd19-f5ca-4905-919f-bf02e95e3b6a"
      ]
   },
   "AssignDefault":true
}`

		var settings idpsync.OrganizationSyncSettings
		settings.AssignDefault = true
		err := settings.Set(legacy)
		require.NoError(t, err)

		require.Equal(t, settings.Field, "groups", "field")
		require.Equal(t, settings.Mapping, map[string][]uuid.UUID{
			"engineering": {
				uuid.MustParse("10b2bd19-f5ca-4905-919f-bf02e95e3b6a"),
			},
		}, "mapping")
		require.True(t, settings.AssignDefault, "assign default")
	})

	t.Run("AssignDefault,False", func(t *testing.T) {
		legacy := `{
   "Field":"groups",
   "Mapping":{
      "engineering":[
         "10b2bd19-f5ca-4905-919f-bf02e95e3b6a"
      ]
   },
   "AssignDefault":false
}`

		var settings idpsync.OrganizationSyncSettings
		settings.AssignDefault = true
		err := settings.Set(legacy)
		require.NoError(t, err)

		require.Equal(t, settings.Field, "groups", "field")
		require.Equal(t, settings.Mapping, map[string][]uuid.UUID{
			"engineering": {
				uuid.MustParse("10b2bd19-f5ca-4905-919f-bf02e95e3b6a"),
			},
		}, "mapping")
		require.False(t, settings.AssignDefault, "assign default")
	})

	t.Run("CorrectAssign", func(t *testing.T) {
		legacy := `{
   "Field":"groups",
   "Mapping":{
      "engineering":[
         "10b2bd19-f5ca-4905-919f-bf02e95e3b6a"
      ]
   },
   "AssignDefault":false
}`

		var settings idpsync.OrganizationSyncSettings
		settings.AssignDefault = true
		err := settings.Set(legacy)
		require.NoError(t, err)

		require.Equal(t, settings.Field, "groups", "field")
		require.Equal(t, settings.Mapping, map[string][]uuid.UUID{
			"engineering": {
				uuid.MustParse("10b2bd19-f5ca-4905-919f-bf02e95e3b6a"),
			},
		}, "mapping")
		require.False(t, settings.AssignDefault, "assign default")
	})
}

func TestParseOrganizationClaims(t *testing.T) {
	t.Parallel()

	t.Run("AGPL", func(t *testing.T) {
		t.Parallel()

		// AGPL has limited behavior
		s := idpsync.NewAGPLSync(slogtest.Make(t, &slogtest.Options{}),
			runtimeconfig.NewManager(),
			idpsync.DeploymentSyncSettings{
				OrganizationField: "orgs",
				OrganizationMapping: map[string][]uuid.UUID{
					"random": {uuid.New()},
				},
				OrganizationAssignDefault: false,
			})

		ctx := testutil.Context(t, testutil.WaitMedium)

		params, err := s.ParseOrganizationClaims(ctx, jwt.MapClaims{})
		require.Nil(t, err)

		require.False(t, params.SyncEntitled)
	})
}
