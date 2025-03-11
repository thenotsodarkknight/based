import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import NewsCard from "./NewsCard";
import { NewsTopic } from "../types/news";

interface Props {
    topics: NewsTopic[];
    isMobile: boolean;
}

const NewsFeed: React.FC<Props> = ({ topics, isMobile }) => {
    const [index, setIndex] = useState(0);

    if (!isMobile) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-b from-backgroundDark to-backgroundLight">
                <p className="text-textSecondary text-xl text-center max-w-md">
                    This app is optimized for mobile usage only. Please view on a mobile device for the best experience.
                </p>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex items-center justify-center">
            <Swiper
                direction="vertical"
                onSlideChange={(swiper) => setIndex(swiper.activeIndex)}
                spaceBetween={10}
                slidesPerView={1}
                className="h-[90vh] w-full"
                mousewheel={true}
                touchRatio={1.5} // Enhanced touch sensitivity for mobile
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