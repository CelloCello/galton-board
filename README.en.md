# Galton Board Simulator

A fun, interactive Galton board (also known as a bean machine or quincunx) simulation built with Three.js. This application demonstrates probability distribution in a visually engaging way, suitable for both education and entertainment.

## Features

- Interactive 3D Galton board simulation
- Responsive design that works on both desktop and mobile devices
- Colorful, user-friendly interface
- Customizable number of balls

## How to Use

### On Desktop

1. Open `index.html` in any modern web browser
2. Enter the number of balls you want to add (default is 100)
3. Click the "Start" button to begin dropping balls
4. Click "Reset" to clear all balls and start over

### On Mobile

1. Open `index.html` in a mobile browser
2. Enter the number of balls you want to add
3. Tap "Start" to begin dropping balls
4. Tap "Reset" to clear all balls and start over

## About the Galton Board

The Galton board, also known as a bean machine or quincunx, is a device invented by Sir Francis Galton to demonstrate the central limit theorem and normal distribution. As balls fall through a triangular array of pegs, they are randomly deflected left or right, eventually forming a bell curve (normal distribution) in the bins at the bottom.

## Technical Details

This application is built with:

- HTML5
- CSS3
- JavaScript
- Three.js for 3D rendering

## Running Locally

Simply open the `index.html` file in a web browser. No server or installation required!

For the best experience, you may want to serve the files over HTTPS. Here are several easy ways to do this:

### Using Python (if installed)

In the project directory, run:

```
# Python 3
python -m http.server

# Python 2
python -m SimpleHTTPServer
```

Then open `http://localhost:8000` in your browser.

### Using Node.js (if installed)

Install a simple server globally:

```
npm install -g serve
```

Then in the project directory, run:

```
serve
```

And visit the URL shown in the terminal.

### Using VS Code Live Server Extension

If using VS Code, you can install the "Live Server" extension and click "Go Live" in the status bar to serve your files. 