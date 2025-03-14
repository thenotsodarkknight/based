import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import NewsCard from "./NewsCard";
import PullToRefreshWrapper from "./PullToRefreshWrapper";
import { NewsTopic } from "../types/news"; // NewsTopic is now an array of NewsItem

interface Props {
    topics: NewsTopic; // Array of NewsItem
    isMobile: boolean;
    // onRefresh?: () => Promise<void>;
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
        <div className="h-screen w-full pt-20" >
            {/* <PullToRefreshWrapper onRefresh={onRefresh ?? (() => Promise.resolve())}> */}
            <Swiper
                direction="vertical"
                pagination={{ clickable: true }}
                mousewheel={true}
                style={{ height: "calc(100% - 3rem)", zIndex: 2 }}
            >
                {topics.map((item, idx) => (
                    <SwiperSlide key={idx} >
                        <NewsCard newsItem={item} /> {/* Pass NewsItem instead of NewsTopic */}
                    </SwiperSlide>
                ))}
            </Swiper>
            {/* </PullToRefreshWrapper> */}
        </div>
    );
};

export default NewsFeed;