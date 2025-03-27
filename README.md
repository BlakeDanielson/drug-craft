# Drug Craft

An educational game exploring drug policies through an Infinite Craft-style combination mechanic.

## About

Drug Craft is an interactive web-based game that allows players to combine different elements to create and discover various substances. The game aims to provide an educational experience exploring the social and economic aspects of drug policies.

## Features

- Combine basic elements to discover new substances
- AI-powered combination generation for nearly unlimited discoveries
- Search and category filtering for discovered elements
- Persistent storage of your discoveries using localStorage
- Responsive design for both desktop and mobile play

## How to Play

1. Start with the four basic elements: Plant, Chemical, Method, and Container
2. Drag or click elements to combine them
3. Discover new substances through combinations
4. Use the search bar to find specific discoveries
5. Filter discoveries by category
6. Reset your progress if needed with the reset button

## Running the Game

### Standalone Mode

Simply open the `index.html` file in your browser to play the game locally. In this mode, the game will use hardcoded combinations when you combine elements.

### With AI Integration

For the AI-powered combination generation, you need to run the game through the Next.js server:

1. Make sure the game is integrated with the browser-games project
2. Set up your OpenAI API key by copying `.env.local.example` to `.env.local` and adding your key
3. Run the development server with `npm run dev`
4. Access the game through the browser-games interface

## Technical Details

The game consists of:

- `index.html` - The main HTML file with the game structure
- `styles.css` - CSS styling for the game
- `game.js` - Core game logic and functionality
- `api.js` - Fallback API handler for standalone mode

## Integration with Browser Games

If integrating with the browser-games project, an additional API endpoint is available at `/api/generate-combination` which leverages OpenAI's GPT models to generate unique combinations based on the elements provided.

## Educational Purpose

This game is designed purely for educational purposes to explore the social, medical, and policy implications of various substances. It does not promote drug use or illegal activities.