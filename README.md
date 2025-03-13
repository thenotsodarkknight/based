# based: removing 'i' from biased
based is an LLM-powered news analysis application that fetches articles from diverse sources, classifies their biases (left-leaning, right-leaning, speculative, conspiracy-leaning, neutral, etc), and generates balanced summaries. The app presents the latest and most popular news in a swipeable card interface, with each card featuring a neutral summary and links to articles categorized by bias. Users can filter news by "roles" (personas like "Tech Enthusiast" or "Athlete") and click cards to go to the actual article. Based leverages OpenAI, Anthropic, and NewsAPI to deliver a modern, bias-aware news experience. Users can listen to a podcast style conversation of their entire news feed - similar to NotebookLM. Upcoming features include a feature called "vibes" - the ability to style the content ("choose the vibes") based on the user's choice ("official", "semi-casual", "gen-z", "eli5", "domain expert", or "role-based", etc) - or even customize it to your own style using a sample text generated by you.

You cannot filter biases - News from all biases will be equally added to feed.

## [For understanding the motivation for this Application, click here](https://github.com/thenotsodarkknight/based/blob/main/MOTIVATION.md)

> Note: This is not meant for production, it's kind of a weekend project. For example, the podcast generation feature included storing of the podcast temporarily, which requires additional storage resources that I dont have the funds for - Right now I use Vercel Blob to store the textual content, Audio files require upgrading to a better storage for scalability. Additionally, I use the free tier for NewsAPI which limits the number of articles I can source per day - Reach out to abeen9@gmail.com for a demo of the full-scale application with all the features.

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

Development Notes
-----------------

-   **Multi-LLM Support:** Anthropic still does not guarantee structured outputs like OpenAI. Rolled back to prioritize reliability for the outputs - Although error handling & retry methodologies are in place, but wanted to eliminate this risk.

-   **Podcast Generation:** Rolled back temporarily because requires storage resources. I currently use Vercel blob for storing textual data - Audio files require a better storage.

-   **NewsAPI:** Need to upgrade to Paid Tiers for better sourcing of news. NewsAPI free tier delays and has a very limited rate limit/day.
  
Future Enhancements
-------------------

-  **"vibes"**: the ability to style the content ("choose the vibes") based on the user's choice ("official", "semi-casual", "gen-z", "eli5", "domain expert", or "role-based", etc) - or even customize it to your own style using a sample text generated by you

-   **Caching:** Implement Redis or in-memory caching for API responses to improve performance.

-   **User Feedback:** Add thumbs-up/down for bias classifications to refine accuracy.

-   **Dark Mode:** Toggle between light and dark themes.

-   **Optimized News Fetching:** Currently, New News is fetched everytime the app load -> More usage, More news -> To improve reliability, create a cron job in vercel to periodically bulk fetch and process new news articles.
  
-   **Bookmarking:** Save articles to a "Read Later" list.

---------------

## [Demo - Click Here](https://uchicago.box.com/s/xygx90537b4ig66ziv0aklqyvk11ohyw)

Built with ❤️ by Abeen Bhattacharya

Inspired by the need for balanced, bias-aware news consumption
