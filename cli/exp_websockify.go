package cli

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/websocket"

	"github.com/coder/serpent"
)

func (*RootCmd) websockifyCommand() *serpent.Command {
	var (
		args handleWebsockifyArgs
	)

	cmd := &serpent.Command{
		Handler: func(inv *serpent.Invocation) error {
			args.Command = inv.Args
			return handleWebsockify(inv, args)
		},
		Long: "Establish an Websocket proxy for an arbitrary application.",
		Options: []serpent.Option{
			{
				Name:          "listener",
				Description:   "The IP:Port for the websock proxy to listen on.",
				Flag:          "listener",
				FlagShorthand: "l",
				Default:       "",
				Value:         serpent.StringOf(&args.Listener),
			},
			{
				Name:          "target",
				Description:   "The IP:Port to send proxied traffic to.",
				Flag:          "target",
				FlagShorthand: "t",
				Default:       "",
				Value:         serpent.StringOf(&args.Target),
			},
			{
				Name:          "webserver root folder",
				Description:   "Folder from which to serve simple static content.",
				Flag:          "web-root",
				FlagShorthand: "r",
				Default:       "",
				Value:         serpent.StringOf(&args.WebRoot),
			},
		},
		Short: "Establish an Websockify session with a workspace/agent.",
		Use:   "websockify",
	}

	return cmd
}

type handleWebsockifyArgs struct {
	Command  []string
	Listener string
	Target   string
	WebRoot  string
}

func handleWebsockify(inv *serpent.Invocation, args handleWebsockifyArgs) error {
	_, cancel := context.WithCancel(inv.Context())
	defer cancel()

	path, err := os.Getwd()
	if err != nil {
		return err
	}

	mux := http.NewServeMux()

	switch {
	case args.WebRoot == path:
		log.Println("Refusing to serve static content from the current working directory.")
		log.Println("Please use the --web-root flag to specify a different directory.")
		log.Println("Exiting.")
		return nil
	case args.WebRoot == "":
		log.Println("No web root specified; serving no static content.")
	default:
		log.Printf("Serving %s at %s", args.WebRoot, args.Listener)
		mux.Handle("/", http.FileServer(http.Dir(args.WebRoot)))
	}

	log.Printf("Serving WS of %s at %s", args.Target, args.Listener)
	mux.HandleFunc("/websockify", newServeWS(args.Target))

	s := &http.Server{
		Addr:           args.Listener,
		Handler:        mux,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	if err := s.ListenAndServe(); err != nil {
		return err
	}
	return err
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return r.Header.Get("Origin") != ""
	},
}

func forwardTCP(wsConn *websocket.Conn, conn net.Conn) {
	var tcpBuffer [1024]byte
	defer func() {
		if conn != nil {
			conn.Close()
		}
		if wsConn != nil {
			wsConn.Close()
		}
	}()
	for {
		if (conn == nil) || (wsConn == nil) {
			return
		}
		n, err := conn.Read(tcpBuffer[0:])
		if err != nil {
			log.Printf("reading from TCP failed: %s", err)
			return
		}

		if err := wsConn.WriteMessage(websocket.BinaryMessage, tcpBuffer[0:n]); err != nil {
			log.Printf("writing to WS failed: %s", err)
		}

	}
}

func forwardWeb(wsConn *websocket.Conn, conn net.Conn) {
	defer func() {
		if err := recover(); err != nil {
			log.Printf("reading from WS failed: %s", err)
		}
		if conn != nil {
			conn.Close()
		}
		if wsConn != nil {
			wsConn.Close()
		}
	}()
	for {
		if (conn == nil) || (wsConn == nil) {
			return
		}

		_, buffer, err := wsConn.ReadMessage()
		if err == nil {
			if _, err := conn.Write(buffer); err != nil {
				log.Printf("writing to TCP failed: %s", err)
			}
		}
	}
}

func newServeWS(targetAddr string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("failed to upgrade to WS: %s", err)
			return
		}

		vnc, err := net.Dial("tcp", targetAddr)
		if err != nil {
			log.Printf("failed to bind to the target: %s", err)
		}

		go forwardTCP(ws, vnc)
		go forwardWeb(ws, vnc)
	}
}
