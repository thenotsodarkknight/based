/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./pages/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./app/**/*.{ts,tsx}", // Include if using Next.js App Router (optional)
    ],
    theme: {
        extend: {
            colors: {
                primary: "#7F00FF",
                backgroundDark: "#1A1A1A",
                backgroundLight: "#2A2A2A",
                textPrimary: "#FFFFFF",
                textSecondary: "#D1D1D1",
                leftBias: "#FF4D4D",
                rightBias: "#4D94FF",
                neutralBias: "#A1A1A1",
            },
        },
    },
    plugins: [],
};