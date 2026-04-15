module.exports = {
    content: ["./src/renderer/index.html", "./src/renderer/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: "#5A189A",
                    accent: "#FFD60A"
                }
            },
            boxShadow: {
                glass: "0 8px 30px rgba(90, 24, 154, 0.25)"
            }
        }
    },
    plugins: []
};
