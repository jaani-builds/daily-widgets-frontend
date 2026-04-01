# daily-widgets-frontend

Thin static frontend for the Simple API backend.

## Structure

```
daily-widgets-frontend/
	index.html
	src/
		api.js
		fx-widget.js
		main.js
		utils.js
		weather-widget.js
	styles/
		main.css
	README.md
```

The app uses these backend endpoints:

- `GET /weather?city=...`
- `GET /location-profile?city=...&country=...&temperature_c=...&windspeed_kmh=...`
- `GET /exchange-rates?base=...&target=...`
- `GET /exchange-rates?base=...&target=...&period_value=...&period_unit=...`
- `GET /news?city=...&country=...&limit=...`

## Features

- Weather + local widget cards for any city supported by the API
- Country-aware location profile (currency + GIF metadata) from backend
- Local currency trends vs USD and EUR
- Top 10 location news from backend
- Exchange-rate lookup and historical chart

## Run locally

Serve the folder as static files:

```bash
cd daily-widgets-frontend
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## API source modes

The app supports two runtime modes:

- Local development mode: `http://localhost:8000` (local Docker backend)
- Production mode: `https://daily-widgets-backend.onrender.com`

Mode selection is automatic:

- If the frontend is opened on `localhost` or `127.0.0.1`, it uses local mode.
- For any other host, it uses production mode.

You can override the mode with a URL query parameter:

- Force local mode: `?api=local`
- Force production mode: `?api=prod`

## Deploy on Render

This repo includes `render.yaml` and `Dockerfile`.

1. Push changes to GitHub.
2. In Render, choose **New > Blueprint**.
3. Connect the GitHub repo and apply the blueprint.
4. Render deploys the static frontend on the free tier.

After deployment, use the Render-assigned URL (e.g., `https://daily-widgets-frontend.onrender.com`).

The frontend will automatically detect that it's on a different host and switch to production mode, using `https://daily-widgets-backend.onrender.com` as the API base.

## Important note about browser access

If you serve the frontend from a different origin than the API, the backend must send CORS headers. The repo has been updated to add FastAPI CORS middleware in the backend so the deployed API can support this after redeployment.
