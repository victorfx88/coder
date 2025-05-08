# Workspace Build Transitions

This guide explains how to perform common workspace operations like start, stop, and delete using the Coder API. Due to the nature of Terraform, these operations are executed as workspace build transitions rather than having dedicated endpoints.

## Overview of Workspace Builds

In Coder, all workspace operations that change the state of a workspace (e.g., start, stop, delete) are implemented as builds. A workspace build is a Terraform operation (`terraform apply` or `terraform destroy`) that provisions or destroys workspace resources.

Workspace builds are created by sending a `CreateWorkspaceBuildRequest` to the `/workspaces/{workspace}/builds` endpoint. The `transition` parameter specifies which operation to perform.

## Workspace State Transitions

Workspaces can have the following transitions:

| Transition | Description |
|------------|-------------|
| `start`    | Start a stopped workspace |
| `stop`     | Stop a running workspace |
| `delete`   | Delete a workspace |

## Common Use Cases

### Starting a Workspace

To start a workspace, create a build with the `start` transition:

```shell
curl -X POST "https://coder.example.com/api/v2/workspaces/{workspace_id}/builds" \
  -H "Content-Type: application/json" \
  -H "Coder-Session-Token: {your_token}" \
  -d '{
    "transition": "start"
  }'
```

### Stopping a Workspace

To stop a workspace, create a build with the `stop` transition:

```shell
curl -X POST "https://coder.example.com/api/v2/workspaces/{workspace_id}/builds" \
  -H "Content-Type: application/json" \
  -H "Coder-Session-Token: {your_token}" \
  -d '{
    "transition": "stop"
  }'
```

### Deleting a Workspace

To delete a workspace, create a build with the `delete` transition:

```shell
curl -X POST "https://coder.example.com/api/v2/workspaces/{workspace_id}/builds" \
  -H "Content-Type: application/json" \
  -H "Coder-Session-Token: {your_token}" \
  -d '{
    "transition": "delete"
  }'
```

### Advanced: Deleting a Workspace Without Destroying Resources (Orphaning)

In some cases, administrators might need to delete a workspace from Coder's database without destroying the underlying infrastructure resources:

```shell
curl -X POST "https://coder.example.com/api/v2/workspaces/{workspace_id}/builds" \
  -H "Content-Type: application/json" \
  -H "Coder-Session-Token: {your_token}" \
  -d '{
    "transition": "delete",
    "orphan": true
  }'
```

**Warning**: Use this option with caution as it will leave cloud resources running without being tracked by Coder, potentially leading to unaccounted costs.

### Updating a Workspace with a New Template Version

To update a workspace to use a new template version:

```shell
curl -X POST "https://coder.example.com/api/v2/workspaces/{workspace_id}/builds" \
  -H "Content-Type: application/json" \
  -H "Coder-Session-Token: {your_token}" \
  -d '{
    "transition": "start",
    "template_version_id": "{new_template_version_id}"
  }'
```

## Monitoring Build Status

You can monitor the progress of a build using the returned build ID:

```shell
curl "https://coder.example.com/api/v2/workspacebuilds/{build_id}" \
  -H "Coder-Session-Token: {your_token}"
```

To fetch build logs:

```shell
curl "https://coder.example.com/api/v2/workspacebuilds/{build_id}/logs?follow=true" \
  -H "Coder-Session-Token: {your_token}"
```

## Using the Coder CLI

The Coder CLI provides a more user-friendly way to manage workspace transitions:

```shell
# Start a workspace
coder start my-workspace

# Stop a workspace
coder stop my-workspace

# Delete a workspace
coder delete my-workspace
```

## Error Handling

Common errors when dealing with workspace builds include:

1. **Build already in progress**: Only one build can be active for a workspace at a time
2. **Unauthorized**: The requesting user doesn't have access to perform the operation
3. **Invalid state transition**: For example, trying to stop an already stopped workspace

Always check the status code and error message in the API response to handle these cases gracefully.