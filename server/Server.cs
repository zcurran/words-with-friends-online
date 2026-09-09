using System;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Collections.Generic;

public class GameServer {
    private static ConcurrentDictionary<string, List<WebSocket>> rooms = new ConcurrentDictionary<string, List<WebSocket>>();
    private static string rootDir;

    public static void Main(string[] args) {
        int port = 8080;
        if (args.Length > 0) int.TryParse(args[0], out port);

        rootDir = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
        Console.WriteLine("=================================================");
        Console.WriteLine("   Words with Friends / Scrabble Game Server");
        Console.WriteLine("   Supporting 1 to 5 Players in Real-Time");
        Console.WriteLine("=================================================");
        Console.WriteLine("Web Root: " + rootDir);
        Console.WriteLine(string.Format("Local URL:   http://localhost:{0}/", port));
        Console.WriteLine("Press Ctrl+C to stop the server.\n");

        HttpListener listener = new HttpListener();
        listener.Prefixes.Add(string.Format("http://*:{0}/", port));
        listener.Prefixes.Add(string.Format("http://localhost:{0}/", port));

        try {
            listener.Start();
        } catch (Exception) {
            // Fallback to localhost only if wildcard requires elevation
            listener = new HttpListener();
            listener.Prefixes.Add(string.Format("http://localhost:{0}/", port));
            listener.Start();
        }

        while (true) {
            try {
                HttpListenerContext context = listener.GetContext();
                ThreadPool.QueueUserWorkItem((state) => HandleContext(context));
            } catch (Exception ex) {
                Console.WriteLine("Listener error: " + ex.Message);
                break;
            }
        }
    }

    private static async void HandleContext(HttpListenerContext context) {
        try {
            if (context.Request.IsWebSocketRequest) {
                HttpListenerWebSocketContext wsContext = await context.AcceptWebSocketAsync(null);
                WebSocket ws = wsContext.WebSocket;
                await HandleWebSocketClient(ws);
            } else {
                ServeStaticFile(context);
            }
        } catch (Exception ex) {
            try {
                context.Response.StatusCode = 500;
                context.Response.Close();
            } catch { }
        }
    }

    private static async Task HandleWebSocketClient(WebSocket ws) {
        byte[] buffer = new byte[8192];
        string currentRoom = "GLOBAL";

        try {
            while (ws.State == WebSocketState.Open) {
                WebSocketReceiveResult result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) {
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                    break;
                }

                string msg = Encoding.UTF8.GetString(buffer, 0, result.Count);
                // Extract room if specified
                if (msg.Contains("\"roomCode\"")) {
                    int keyIdx = msg.IndexOf("\"roomCode\"");
                    int colonIdx = msg.IndexOf(":", keyIdx);
                    if (colonIdx != -1) {
                        int quote1 = msg.IndexOf("\"", colonIdx);
                        if (quote1 != -1) {
                            int quote2 = msg.IndexOf("\"", quote1 + 1);
                            if (quote2 != -1) {
                                currentRoom = msg.Substring(quote1 + 1, quote2 - quote1 - 1).ToUpper().Trim();
                            }
                        }
                    }
                }

                // Add to room tracking
                rooms.AddOrUpdate(currentRoom, 
                    new List<WebSocket> { ws }, 
                    (key, list) => {
                        lock (list) { if (!list.Contains(ws)) list.Add(ws); }
                        return list;
                    });

                // Broadcast to other peers in room
                List<WebSocket> peerList;
                if (rooms.TryGetValue(currentRoom, out peerList)) {
                    List<WebSocket> toRemove = new List<WebSocket>();
                    lock (peerList) {
                        foreach (WebSocket peer in peerList) {
                            if (peer != ws && peer.State == WebSocketState.Open) {
                                byte[] sendBytes = Encoding.UTF8.GetBytes(msg);
                                peer.SendAsync(new ArraySegment<byte>(sendBytes), WebSocketMessageType.Text, true, CancellationToken.None);
                            } else if (peer.State != WebSocketState.Open) {
                                toRemove.Add(peer);
                            }
                        }
                        foreach (var rem in toRemove) peerList.Remove(rem);
                    }
                }
            }
        } catch { }
        finally {
            List<WebSocket> list;
            if (rooms.TryGetValue(currentRoom, out list)) {
                lock (list) { list.Remove(ws); }
            }
        }
    }

    private static void ServeStaticFile(HttpListenerContext context) {
        string rawUrl = context.Request.RawUrl.Split('?')[0];
        if (rawUrl == "/") rawUrl = "/index.html";

        string filePath = Path.Combine(rootDir, rawUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

        if (!File.Exists(filePath)) {
            context.Response.StatusCode = 404;
            byte[] notFound = Encoding.UTF8.GetBytes("404 Not Found");
            context.Response.ContentType = "text/plain";
            context.Response.OutputStream.Write(notFound, 0, notFound.Length);
            context.Response.Close();
            return;
        }

        string ext = Path.GetExtension(filePath).ToLower();
        string contentType = "application/octet-stream";
        if (ext == ".html" || ext == ".htm") contentType = "text/html; charset=utf-8";
        else if (ext == ".css") contentType = "text/css; charset=utf-8";
        else if (ext == ".js") contentType = "application/javascript; charset=utf-8";
        else if (ext == ".json") contentType = "application/json; charset=utf-8";
        else if (ext == ".txt") contentType = "text/plain; charset=utf-8";
        else if (ext == ".png") contentType = "image/png";
        else if (ext == ".jpg" || ext == ".jpeg") contentType = "image/jpeg";
        else if (ext == ".svg") contentType = "image/svg+xml";

        context.Response.ContentType = contentType;
        byte[] fileBytes = File.ReadAllBytes(filePath);
        context.Response.ContentLength64 = fileBytes.Length;
        context.Response.OutputStream.Write(fileBytes, 0, fileBytes.Length);
        context.Response.Close();
    }
}
