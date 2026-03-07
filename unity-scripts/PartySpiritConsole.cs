/**
 * 游戏内「队伍妖灵」：登录进游戏后向 Unity Console (Debug.Log) 输出当前角色队伍。
 * 用法：挂到场景里。若 Inspector 里已填 authToken、characterId，进入游戏时自动打一次；
 *       或在登录/选角完成后调用 LogPartyToConsole(token, characterId)。
 */
#if UNITY_2020_3_OR_NEWER
using UnityEngine;
using UnityEngine.Networking;
using System;
using System.Collections;
using System.Collections.Generic;

[Serializable]
public class PartySlotEntry
{
    public string id;
    public int spiritNumber;
    public string spiritName;
    public string spiritImage;
    public string[] spiritTypes;
    public int level;
    public string nickname;
}

public class PartySpiritConsole : MonoBehaviour
{
    public string apiBaseUrl = "http://localhost:3000";
    public string authToken = "";
    public string characterId = "";

    void Start()
    {
        if (!string.IsNullOrEmpty(authToken) && !string.IsNullOrEmpty(characterId))
            LogPartyToConsole();
    }

    /// <summary>
    /// 拉取队伍并输出到 Unity Console (Debug.Log)。登录进游戏时调用一次即可。
    /// </summary>
    public void LogPartyToConsole(string token = null, string cid = null)
    {
        string t = !string.IsNullOrEmpty(token) ? token : authToken;
        string c = !string.IsNullOrEmpty(cid) ? cid : characterId;
        if (string.IsNullOrEmpty(t) || string.IsNullOrEmpty(c))
        {
            Debug.LogWarning("[PartySpiritConsole] 请设置 authToken 和 characterId，或传入参数。");
            return;
        }
        StartCoroutine(FetchAndLogParty(t, c));
    }

    private IEnumerator FetchAndLogParty(string token, string cid)
    {
        string url = apiBaseUrl.TrimEnd('/') + "/api/user/party?characterId=" + UnityWebRequest.EscapeURL(cid);
        using (var req = UnityWebRequest.Get(url))
        {
            req.SetRequestHeader("Authorization", "Bearer " + token);
            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError("[PartySpiritConsole] 请求失败: " + req.error + " | " + req.downloadHandler?.text);
                yield break;
            }

            string json = req.downloadHandler?.text ?? "";
            try
            {
                var slots = ParsePartyJson(json);
                Debug.Log("[PartySpiritConsole] === 队伍妖灵 ===");
                for (int i = 0; i < 6; i++)
                {
                    var slot = i < slots.Count ? slots[i] : null;
                    int oneBased = i + 1;
                    if (slot == null || string.IsNullOrEmpty(slot.id))
                        Debug.Log("[PartySpiritConsole]   格 " + oneBased + ": (空)");
                    else
                        Debug.Log("[PartySpiritConsole]   格 " + oneBased + ": #" + slot.spiritNumber.ToString("D3") + " " + slot.spiritName + " Lv." + slot.level +
                            (string.IsNullOrEmpty(slot.nickname) ? "" : " \"" + slot.nickname + "\""));
                }
            }
            catch (Exception e)
            {
                Debug.LogError("[PartySpiritConsole] 解析失败: " + e.Message + "\n" + json);
            }
        }
    }

    private static List<PartySlotEntry> ParsePartyJson(string body)
    {
        var list = new List<PartySlotEntry>();
        if (string.IsNullOrEmpty(body)) return list;
        int partyIdx = body.IndexOf("\"party\"", StringComparison.OrdinalIgnoreCase);
        if (partyIdx < 0) return list;
        int arrStart = body.IndexOf('[', partyIdx);
        if (arrStart < 0) return list;
        int depth = 0;
        int start = arrStart + 1;
        for (int i = arrStart + 1; i < body.Length; i++)
        {
            char c = body[i];
            if (c == '{') depth++;
            else if (c == '}') depth--;
            else if (c == '[') depth++;
            else if (c == ']')
            {
                if (depth == 1)
                {
                    string segment = body.Substring(start, i - start).Trim();
                    if (segment.Equals("null", StringComparison.OrdinalIgnoreCase))
                        list.Add(null);
                    else if (segment.StartsWith("{"))
                        list.Add(JsonUtility.FromJson<PartySlotEntry>(segment));
                }
                depth--;
                if (depth < 0) break;
            }
            else if (c == ',' && depth == 1)
            {
                string segment = body.Substring(start, i - start).Trim();
                start = i + 1;
                if (segment.Equals("null", StringComparison.OrdinalIgnoreCase))
                    list.Add(null);
                else if (segment.StartsWith("{"))
                    list.Add(JsonUtility.FromJson<PartySlotEntry>(segment));
            }
        }
        return list;
    }
}
#endif
