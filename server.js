// Update this line to point to the correct file
require('dotenv').config({ path: './.env.local' });

const express = require('express');
const fetch = require('node-fetch');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET; // Add this line
const REDIRECT_URI = process.env.REDIRECT_URI;



console.log('Environment Variables:');
console.log('SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID);
console.log('SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET);
console.log('REDIRECT_URI:', process.env.REDIRECT_URI);
const app = express();

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

app.get('/login', function (req, res) {
    const state = generateRandomString(16);
    const scope = 'user-read-private user-read-email';

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
        state: state,
    });

    console.log('Redirecting to Spotify with params:', params.toString());  // Debugging the params

    res.redirect('https://accounts.spotify.com/authorize?' + params.toString());
});

app.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;

    // Handle errors from Spotify
    if (error) {
        console.error('Error from Spotify:', error);
        return res.redirect(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/error?message=${error}`);
    }

    // Verify we got the code
    if (!code) {
        console.error('No code received from Spotify');
        return res.redirect(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/error?message=missing_code`);
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(
                    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                ).toString('base64')
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.REDIRECT_URI
            }).toString()
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('Token exchange error:', errorData);
            return res.redirect(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/error?message=token_exchange_failed`);
        }

        const {
            access_token,
            refresh_token,
            expires_in,
            token_type
        } = await tokenResponse.json();

        // Get user profile with the new access token
        const userResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        if (!userResponse.ok) {
            console.error('Failed to fetch user profile');
            return res.redirect(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/error?message=profile_fetch_failed`);
        }

        const userData = await userResponse.json();

        // Store tokens securely (you should implement this based on your needs)
        // This is just an example using cookies - in production you might want to use
        // a more secure solution like storing in a database and providing a session token
        res.cookie('spotify_access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: expires_in * 1000 // convert to milliseconds
        });

        res.cookie('spotify_refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        // Redirect to frontend with success
        res.redirect(
            `${process.env.NEXT_PUBLIC_FRONTEND_URL}/auth-success?` +
            new URLSearchParams({
                user_id: userData.id,
                display_name: userData.display_name || '',
                // Don't send sensitive data in URL
            }).toString()
        );

    } catch (error) {
        console.error('Callback error:', error);
        res.redirect(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/error?message=server_error`);
    }
});

// Add a refresh token endpoint
app.post('/refresh-token', async (req, res) => {
    const refresh_token = req.cookies.spotify_refresh_token;

    if (!refresh_token) {
        return res.status(401).json({ error: 'No refresh token' });
    }

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(
                    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                ).toString('base64')
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refresh_token
            }).toString()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to refresh token');
        }

        // Update the access token cookie
        res.cookie('spotify_access_token', data.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: data.expires_in * 1000
        });

        // If a new refresh token was provided, update it
        if (data.refresh_token) {
            res.cookie('spotify_refresh_token', data.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
        }

        res.json({
            success: true,
            expires_in: data.expires_in
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// Add necessary middleware for cookies
const cookieParser = require('cookie-parser');
app.use(cookieParser());

const PORT = 5000;

app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
