import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import NewsCard from "./NewsCard";
import { NewsTopic } from "../types/news";

interface Props {
    topics: NewsTopic[];
    isMobile: boolean;
}

const NewsFeed: React.FC<Props> = ({ topics, isMobile }) => {
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
        <div className="h-screen w-full pt-16"> {/* Adjust padding top to match navbar height */}
            <Swiper
                direction="vertical"
                pagination={{ clickable: true }}
                mousewheel={true}
                style={{ height: "calc(100% - 4rem)" }} // Adjust height to account for navbar
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
