# AI Agent Chat

## List all running AI agents

### Code samples

```shell
# Example request using curl
curl -X GET http://coder-server:8080/api/v2/aiagent/chats \
  -H 'Accept: */*' \
  -H 'Coder-Session-Token: API_KEY'
```

`GET /aiagent/chats`

### Example responses

> 200 Response

### Responses

| Status | Meaning                                                 | Description | Schema                                                 |
|--------|---------------------------------------------------------|-------------|--------------------------------------------------------|
| 200    | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK          | [codersdk.AIAgentList](schemas.md#codersdkaiagentlist) |

To perform this operation, you must be authenticated. [Learn more](authentication.md).
