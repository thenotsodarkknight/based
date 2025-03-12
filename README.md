# based: removing 'i' from biased
based is an LLM-powered news analysis application that fetches articles from diverse sources, classifies their biases (left-leaning, right-leaning, speculative, conspiracy-leaning, neutral, etc), and generates balanced summaries. The app presents the latest and most popular news in a swipeable card interface, with each card featuring a neutral summary and links to articles categorized by bias. Users can filter news by "roles" (personas like "Tech Enthusiast" or "Athlete") and click cards to go to the actual article. Based leverages OpenAI, Anthropic, and NewsAPI to deliver a modern, bias-aware news experience. Users can listen to a podcast style conversation of their entire news feed - similar to NotebookLM. Upcoming features include the ability to style the content based on the user's choice ("official", "semi-casual", "gen-z", "eli5", "domain expert", or "role-based", etc)

You cannot filter biases - News from all biases will be equally added to feed.

> Note: This is not meant for production, it's kind of a weekend project. For example, the podcast generation feature included storing of the podcast temporarily, which requires storage resources that I dont have the funds for. Additionally, I use the free tier for NewsAPI which limits the number of articles I can source per day - Reach out to abeen9@gmail for a demo of the full-scale application with all the features.

<div style="display: flex;">
  <img style="width: 32%;" src="https://github.com/user-attachments/assets/16d3d864-1950-440d-9972-37fe86df0e20" />
  <img style="width: 32%;" src="https://github.com/user-attachments/assets/6298aaa8-bd21-4f32-81ad-269daeb29d19" />
  <img style="width: 32%;" src="https://github.com/user-attachments/assets/753293c4-4012-4a83-a62c-bf727075e0d8" />
  <br></br>Previous Version:<br><br/>
  <img src="https://github.com/user-attachments/assets/e5ad5519-47cb-4734-ae18-9ec2002ead10" alt="IMG_9660" style="width: 32%;">
  <img src="https://github.com/user-attachments/assets/fbf2a571-3124-4709-b09d-1d524dea0d19" alt="IMG_9664" style="width: 32%;">
  <img src="https://github.com/user-attachments/assets/0d2442ce-89fe-484a-8793-ffb158ec8143" alt="IMG_9665" style="width: 32%;">
</div>

Features
--------

-   **Swipeable News Cards:** Browse the latest news in a card interface, with the most recent articles on top.

-   **Bias Classification:** Automatically classifies articles as left-leaning, right-leaning, or neutral using a hybrid approach (source ratings + LLM analysis).

-   **Balanced Summaries:** Generates neutral summaries by synthesizing multiple perspectives, even when neutral sources are absent.

-   **"Roles" Filter:** Customize the news feed based on personas (e.g., "Tech Enthusiast," "Athlete," "Influencer," "Actor").

-   **"Podcast" Generation:** Listen to a podcast style conversation of your entire news feed - similar to NotebookLM

-   **Detailed Analysis:** Click a card to view an in-depth breakdown of an article's bias and summary.

-   **Multi-Source Feeds:** Pulls articles from NewsAPI, ensuring diverse viewpoints.

Tech Stack
----------

-   **Frontend & Backend:** Next.js (React framework with API routes)

-   **Language:** TypeScript

-   **News API:** NewsAPI

-   **LLM API:** OpenAI, Anthropic

-   **UI Library:** Swiper.js (for swipeable cards), MUI (for UI components)

-   **Deployment:** Vercel (serverless hosting with zero-config infrastructure and global CDN)

-   **Utilities:** node-readability (full-text extraction), zod (schema validation)

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
git clone https://github.com/thenotsodarkknight/based.git
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
ANTHROPIC_API_KEY=your_anthropic_key
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

-   **Bias Classification:** Classifies source ratings with OpenAI and Anthropic analysis, with schema validation using Zod to enforce a single keyword for bias.

-   **Summaries:** Generated by feeding LLMs multiple article perspectives to ensure neutrality, with recent fixes to handle parsing failures using retries and refined prompts.

-   **Limitations:** NewsAPI free tier has delays and no full-text content; node-readability fetches full articles but may fail on some sites.

Future Enhancements
-------------------

-   **Multi-LLM Support:** Expand to include Cohere via a modular abstraction layer (in progress with Anthropic integration).

-   **Caching:** Implement Redis or in-memory caching for API responses to improve performance.

-   **User Feedback:** Add thumbs-up/down for bias classifications to refine accuracy.

-   **Dark Mode:** Toggle between light and dark themes.

-   **Bookmarking:** Save articles to a "Read Later" list.

---------------

## [Demo - Click Here](https://uchicago.box.com/s/xygx90537b4ig66ziv0aklqyvk11ohyw)

Built with ❤️ by Abeen Bhattacharya

Inspired by the need for balanced, bias-aware news consumption
