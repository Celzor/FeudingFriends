# messages

## general
- create room
returns:
```json
{
  "room_id": "room_id"
}
```

- join room (room_id)
returns:
```json
{
  "room_id": "room_id",
    "players": ["player1", "player2"]
     
}
```

- leave room

## host messages
- start game
- choose chosen answer
- next round
- end game

# player messages
- set user name
- take host (if no host in game)
