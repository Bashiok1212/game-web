# Unity 游戏内脚本

本目录下的脚本需**复制到你的 Unity 项目**中使用（例如 `Assets/Scripts/`），与网站/服务端同仓库存放，便于版本统一。

## PartySpiritConsole.cs — 登录进游戏时在 Console 显示队伍妖灵

拉取当前角色的 6 格队伍，仅输出到 **Unity Console**（Debug.Log），无按键、无画面面板。

### 使用步骤

1. 将 `PartySpiritConsole.cs` 复制到 Unity 项目的 `Assets/Scripts/`（或任意脚本目录）。
2. 在**进入游戏后的场景**里挂到某个物体上（例如游戏主场景的常驻对象）。
3. 二选一：
   - **自动**：在 Inspector 里填好 `apiBaseUrl`、`authToken`、`characterId`（可由你登录脚本在运行时赋值），该物体 `Start()` 时会自动拉取并打印一次到 Console。
   - **手动**：登录/选角完成后调用  
     `GetComponent<PartySpiritConsole>().LogPartyToConsole(token, characterId);`
4. 运行游戏并登录进游戏后，在 Unity 窗口底部 **Window → General → Console** 打开 Console，即可看到类似：
   ```
   [PartySpiritConsole] === 队伍妖灵 ===
   [PartySpiritConsole]   格 1: #001 妙蛙种子 Lv.5 "蒜头"
   [PartySpiritConsole]   格 2: #004 小火龙 Lv.3
   [PartySpiritConsole]   格 3: (空)
   ...
   ```

### 与现有逻辑对接

若登录后 token/characterId 是之后才赋值的，在赋值完成处调用一次即可：

```csharp
// 选角/进入游戏后
FindObjectOfType<PartySpiritConsole>()?.LogPartyToConsole(AuthApi.Token, GameState.CurrentCharacterId);
```

脚本使用 `GET /api/user/party?characterId=xxx` 和 `Authorization: Bearer <token>`，与 API 文档一致。
