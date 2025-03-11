import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import NewsCard from "./NewsCard";
import { NewsArticle } from "../types/news";

interface Props {
    articles: NewsArticle[];
}

const NewsFeed: React.FC<Props> = ({ articles }) => {
    const [index, setIndex] = useState(0);

    return (
        <div className="h-screen w-full flex items-center justify-center">
            <Swiper
                direction="vertical"
                onSlideChange={(swiper) => setIndex(swiper.activeIndex)}
                spaceBetween={20}
                slidesPerView={1}
                className="h-[90vh] w-full max-w-md"
                mousewheel={true} // Enable mouse wheel scrolling
                touchReleaseOnEdges={true} // Smooth edge release
            >
                {articles.map((article, idx) => (
                    <SwiperSlide key={idx}>
                        <NewsCard article={article} />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
};

export default NewsFeed;