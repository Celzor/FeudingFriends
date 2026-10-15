# redis keys and data structure

- rooms
holds the lobby code, owner and players connection ids



- game
holds the state of a game in play

this is
 - all actions that took place in the game
 - 







- connections
tracks the sockets connected
key: connId








- questions
data table that is seeded with questions

shape like this?
```json
[{
    question: "How many are there?",
    answers: [{
        title: "one",
        score: 123,
    }]   
}]
```