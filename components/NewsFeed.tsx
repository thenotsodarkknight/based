import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import NewsCard from "./NewsCard";
import { NewsTopic } from "../types/news";

interface Props {
    topics: NewsTopic[];
}

const NewsFeed: React.FC<Props> = ({ topics }) => {
    const [index, setIndex] = useState(0);

    return (
        <div className="h-screen w-full flex items-center justify-center">
            <Swiper
                direction="vertical"
                onSlideChange={(swiper) => setIndex(swiper.activeIndex)}
                spaceBetween={20}
                slidesPerView={1}
                className="h-[90vh] w-full max-w-md"
                mousewheel={true}
                touchReleaseOnEdges={true}
                effect="slide"
            >
                {topics.map((topic, idx) => (
                    <SwiperSlide key={idx}>
                        <NewsCard topic={topic} />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
};

export default NewsFeed;