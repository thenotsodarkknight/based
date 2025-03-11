/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: "#7F00FF", // Main purple
                backgroundDark: "#1A1A1A", // Dark background start
                backgroundLight: "#2A2A2A", // Dark background end
                textPrimary: "#FFFFFF", // White text
                textSecondary: "#D1D1D1", // Light gray text
                leftBias: "#FF4D4D", // Red for left-leaning
                rightBias: "#4D94FF", // Blue for right-leaning
                neutralBias: "#A1A1A1", // Gray for neutral
            },
        },
    },
    plugins: [],
};