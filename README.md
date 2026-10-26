# Gathered

A small, local event tracker built with Node.js and browser-native JavaScript. Events are stored in `data/events.json` on this machine.

## Run

Requires Node.js 18 or newer. From this folder, run:

```sh
npm start
```

Then open <http://localhost:3000>. Set the `PORT` environment variable to use another port.

## Features

- Create, edit, and delete events
- Track date, time, location, category, notes, and attendance status
- Search events and filter by upcoming, all, or past
- View a quick count of events this month and over the next seven days
- Keep event data in a local JSON file