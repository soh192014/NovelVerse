/* =====================================================
   NovelVerse — Example Configuration
   ===================================================== */

window.NOVELVERSE_CONFIG = {

    SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",

    SUPABASE_ANON_KEY: "YOUR_PUBLIC_KEY",

    APP_NAME: "NovelVerse",

    APP_VERSION: "1.0.0",

    MAX_BOOK_SIZE: 20 * 1024 * 1024,

    MAX_COVER_SIZE: 5 * 1024 * 1024,

    ALLOWED_BOOK_TYPES: [
        "txt",
        "pdf",
        "epub"
    ],

    POINTS: {

        NEW_USER_BONUS: 150,

        MIN_CHECKIN: 10,

        MAX_CHECKIN: 100,

        MIN_READ_PRICE: 10,

        MAX_READ_PRICE: 200,

        MIN_OFFLINE_PRICE: 200,

        MAX_OFFLINE_PRICE: 1000,

        MIN_DOWNLOAD_PRICE: 2000,

        MAX_DOWNLOAD_PRICE: 10000,

        MIN_COMPLETE_REWARD: 50,

        MAX_COMPLETE_REWARD: 200

    },

    THEME: {

        DEFAULT: "default",

        ALLOW_CUSTOM_COLOR: true,

        SAVE_LOCALLY: true

    }

};
