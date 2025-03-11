# based

based is an LLM-powered news analysis application that fetches articles from diverse sources, classifies their political leanings (left-leaning, right-leaning, or neutral), and generates balanced summaries. The app presents news in a swipeable card interface, with each card featuring a neutral summary and links to articles categorized by bias. Users can filter news by "vibes" (personas like "Tech Enthusiast" or "Athlete") and click cards for detailed analysis. Built for speed and scalability, Based leverages OpenAI and NewsAPI to deliver a modern, bias-aware news experience.

Features
--------

-   **Swipeable News Cards:** Browse the latest news in a Tinder-like card interface, with the most recent articles on top.

-   **Bias Classification:** Automatically classifies articles as left-leaning, right-leaning, or neutral using a hybrid approach (source ratings + LLM analysis).

-   **Balanced Summaries:** Generates neutral summaries by synthesizing multiple perspectives, even when neutral sources are absent.

-   **"Vibes" Filter:** Customize the news feed based on personas (e.g., "Tech Enthusiast," "Athlete," "Influencer," "Actor").

-   **Detailed Analysis:** Click a card to view an in-depth breakdown of an article's bias and summary.

-   **Multi-Source Feeds:** Pulls articles from NewsAPI, ensuring diverse viewpoints.

Tech Stack
----------

-   **Frontend & Backend:** Next.js (React framework with API routes)

-   **Language:** TypeScript

-   **News API:** NewsAPI

-   **LLM API:** OpenAI

-   **UI Library:** Swiper.js (for swipeable cards), MUI (for UI components)

-   **Deployment:** Vercel (serverless hosting)

-   **Utilities:** node-readability (full-text extraction)

Prerequisites
-------------

-   Node.js (v16 or later)

-   npm or yarn

-   API keys:

    -   NewsAPI key

    -   OpenAI key

Installation
------------

### Clone the Repository:

```
git clone https://github.com/your-username/based.git
cd based
```

### Install Dependencies:

```
npm install
```

### Set Up Environment Variables:

Create a `.env.local` file in the root directory and add your API keys:

```
NEWSAPI_KEY=your_newsapi_key
OPENAI_API_KEY=your_openai_key
```

### Run the Development Server:

```
npm run dev
```

Open <http://localhost:3000> in your browser to see the app.

Usage
-----

-   **Home Page:** Swipe through news cards, each showing a neutral summary and links to left-leaning, right-leaning, and neutral articles (when available).

-   **"Vibes" Filter:** Use the dropdown to switch between personas (e.g., "Tech Enthusiast") and tailor the news feed.

-   **Detailed Analysis:** Click the "View Detailed Analysis" button on any card to see a full breakdown of the article's bias and summary.

Project Structure
-----------------

```
based/
├── pages/
│   ├── api/
│   │   ├── classify.ts       # LLM-based bias classification
│   │   └── news.ts           # NewsAPI integration
│   ├── article.tsx           # Detailed analysis page
│   └── index.tsx             # Main news feed with swipeable cards
├── .env.local                # Environment variables (not tracked)
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

Deployment
----------

Deploy the app to Vercel for free, scalable hosting:

### Push to GitHub:

```
git add .
git commit -m "Initial commit"
git push origin main
```

### Deploy with Vercel:

1.  Sign up at [Vercel](https://vercel.com/).

2.  Import your GitHub repository.

3.  Add environment variables (`NEWSAPI_KEY`, `OPENAI_API_KEY`) in the Vercel dashboard.

4.  Deploy the app and access it via the provided URL.

Development Notes
-----------------

-   **Bias Classification:** Combines predefined source ratings (e.g., CNN as "left") with OpenAI analysis for unknown sources.

-   **Summaries:** Generated by feeding OpenAI multiple article perspectives to ensure neutrality.

-   **Limitations:** NewsAPI free tier has delays and no full-text content; node-readability fetches full articles but may fail on some sites.

Future Enhancements
-------------------

-   **Multi-LLM Support:** Add Anthropic or Cohere via a modular abstraction layer.

-   **Caching:** Implement Redis or in-memory caching for API responses.

-   **User Feedback:** Add thumbs-up/down for bias classifications to refine accuracy.

-   **Dark Mode:** Toggle between light and dark themes.

-   **Bookmarking:** Save articles to a "Read Later" list.

Contributing
------------

Contributions are welcome! To contribute:

1.  Fork the repository.

2.  Create a feature branch (`git checkout -b feature-name`).

3.  Commit your changes (`git commit -m "Add feature"`).

4.  Push to the branch (`git push origin feature-name`).

5.  Open a pull request.

License
-------

This project is licensed under the MIT License. See LICENSE for details.

Acknowledgments
---------------

Built with ❤️ by Abeen Bhattacharya

Inspired by the need for balanced, bias-aware news consumption
