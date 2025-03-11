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
        <Swiper
            direction="vertical"
            onSlideChange={(swiper) => setIndex(swiper.activeIndex)}
            spaceBetween={10}
            slidesPerView={1}
            className="h-[80vh]"
        >
            {articles.map((article, idx) => (
                <SwiperSlide key={idx}>
                    <NewsCard article={article} />
                </SwiperSlide>
            ))}
        </Swiper>
    );
};

export default NewsFeed;