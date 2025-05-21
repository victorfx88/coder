package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"time"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

func main() {
	// flags so the binary is easy to script
	assistantID := flag.String("assistant", "", "Assistant ID (ass-...)")
	prompt := flag.String("msg", "Hello from Go!", "Initial user prompt")
	flag.Parse()
	if *assistantID == "" {
		log.Fatalln("missing -assistant flag")
	}

	// Client picks the API key from OPENAI_API_KEY automatically.
	cl := openai.NewClient(option.WithRequestTimeout(time.Minute * 5))

	ctx := context.Background()

	// 1) Create an empty thread
	thread, err := cl.Beta.Threads.New(ctx, openai.BetaThreadNewParams{})
	if err != nil {
		log.Fatalf("create thread: %v", err)
	}

	// 2) Push the first user message into that thread
	_, err = cl.Beta.Threads.Messages.New(ctx, thread.ID,
		openai.BetaThreadMessageNewParams{
			Role: openai.BetaThreadMessageNewParamsRoleUser,
			Content: openai.BetaThreadMessageNewParamsContentUnion{
				OfString: openai.String(*prompt),
			},
		},
	)
	if err != nil {
		log.Fatalf("add message: %v", err)
	}

	// 3. Fire a streaming run
	stream := cl.Beta.Threads.Runs.NewStreaming(ctx, thread.ID,
		openai.BetaThreadRunNewParams{
			AssistantID: *assistantID,
		})
	defer stream.Close()

	fmt.Print("Assistant ▶ ")

	// 4. Drain the SSE stream as it arrives
	for stream.Next() { // blocks until a chunk is available
		ev := stream.Current() // ev has fields: Event, Data, RawJSON etc.
		
		switch ev.Event {
		case "thread.message.delta": // token-by-token text
			for _, c := range ev.Data.Delta.Content {
				fmt.Printf("%s", c.Text.Value)
			}

		case "thread.message.completed": // clean break between messages
			fmt.Println()

		case "thread.run.requires_action": // tool/function call
			fmt.Printf("\n[assistant requested action: %+v]\n", ev.Data)

		case "thread.run.completed":
			fmt.Println("\n[run completed]")
		case "thread.run.failed":
			fmt.Printf("\n[assistant run failed: %+v]\n", ev.Data)
			// if run, ok := ev.Data.AsThreadRun(); ok {
			//	log.Fatalf("\n[run failed] %s\n", run.LastError.Message)
			//}
		}
	}
	fmt.Println()

	// 5. Handle any network / decode error
	if err := stream.Err(); err != nil {
		log.Fatalf("stream: %v", err)
	}
}
