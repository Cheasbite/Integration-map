## Showcasing how POST room, kiosk, and map

## Note
Before you begin, please clone the project
```bash
git clone https://github.com/Cheasbite/Integration-map.git
```
Then run
```bash
npm install
```

Now you should be able to run the project which then please go to /dashboard

PS: The code is bad, please look away

## On room and kiosk
[!Room Dashboard](./public/screenshot/Rooms.png)
[!Kiosk Dashboard](./public/screenshot/Kiosks.png)

### Color code definitions:
- Blue identifies the existing rooms on that floor
- Green identifies the existing kiosks on that floor
- Red is the selected coords to submit the back-end (posX, posY aka verticies too but Claude says its unecessary)

So the goal in rooms is to:
- View existing rooms
- Add a new rooms
- When adding a new rooms, add the "verticies" in the map before sending it

### Same can be said with kiosk

## Map
[!Map View](./public/screenshot/Map.png)
[!Floor View](./public/screenshot/Floor.png)

### Exclusive to Map Dashboard only
- Able to see the connected nodes (drawn with purple line)
- Able to see the cross referenced nodes (teleporters), black circled
- Add new floors

### The main goal in Map Dashboard
- Create new floor
- Connect nodes
- Create Teleporters

## Notice
This is just a showcase of my idea with tweaks for the database, I'm sharing that in the video.
It's not a replacement of the previous idea but this one should be done instead to allow us to efficiently
integrate with our current project without massive changes.

- This lacks the logic that show the ideal path from one node to another
- No side view to allow user to see what is being connected
- No information view that tells the node properties

### What this likely propose:
- No building table
- "Verticies" and edges are separate tables
- Now to sending things in the database would become a transaction of 2 (A handshake) else both will fail

