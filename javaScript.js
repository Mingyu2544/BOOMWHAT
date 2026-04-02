const express = require("express");
const axios = require("axios");
const session = require("express-session");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// 🔐 Redirect ไป Discord
app.get("/login", (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${process.env.REDIRECT_URI}&scope=identify%20guilds.members.read%20role_connections.write`;
    res.redirect(url);
});

// 🔁 Callback
app.get("/callback", async (req, res) => {
    const code = req.query.code;

    try {
        const tokenRes = await axios.post("https://discord.com/api/oauth2/token", new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: process.env.REDIRECT_URI
        }), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });

        const accessToken = tokenRes.data.access_token;

        // 📌 ดึง user
        const userRes = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = userRes.data;

        // 📌 ดึง member (เช็ค role)
        const memberRes = await axios.get(
            `https://discord.com/api/users/@me/guilds/${process.env.GUILD_ID}/member`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const roles = memberRes.data.roles;

        // 🔥 เช็ค role
        const hasRole = roles.includes(process.env.ROLE_ID);

        // 🔗 push Linked Roles
        await axios.put(
            `https://discord.com/api/v10/users/@me/applications/${process.env.CLIENT_ID}/role-connection`,
            {
                platform_name: "My Map Website",
                metadata: { verified: hasRole }
            },
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        req.session.user = {
            id: user.id,
            hasRole
        };

        res.redirect("/status");

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.send("Login failed");
    }
});

// ✅ เช็คสิทธิ์
app.get("/status", (req, res) => {
    if (!req.session.user) {
        return res.json({ login: false });
    }

    res.json({
        login: true,
        hasRole: req.session.user.hasRole
    });
});

app.listen(3000, () => console.log("Server running"));