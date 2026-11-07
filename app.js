/* =====================================================
   NovelVerse 1.0
   Frontend Application
   HTML + CSS + JavaScript + Supabase
===================================================== */

(() => {
    "use strict";

    // =================================================
    // 1. INITIALIZATION
    // =================================================

    const config = window.NOVELVERSE_CONFIG;

    if (!config || !window.supabase) {
        console.error("NovelVerse: Supabase configuration missing.");
        alert("配置文件加载失败，请检查 config.js 和 Supabase CDN。");
        return;
    }

    const { createClient } = window.supabase;

    const supabase = createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY
    );

    let currentUser = null;
    let currentProfile = null;
    let books = [];
    let currentBook = null;

    const $ = id => document.getElementById(id);

    // =================================================
    // 2. UTILITIES
    // =================================================

    function showToast(message) {
        const toast = $("toast");

        if (!toast) {
            console.log(message);
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(showToast.timer);

        showToast.timer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    function setMessage(id, message, success = false) {
        const element = $(id);

        if (!element) return;

        element.textContent = message;

        element.style.color = success
            ? "#16a34a"
            : "#dc2626";
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
    }

    function getExtension(filename) {
        return filename.split(".").pop().toLowerCase();
    }

    function formatDate(date) {
        return new Date(date).toLocaleDateString("zh-CN");
    }

    // =================================================
    // 3. AUTHENTICATION
    // =================================================

    async function refreshSession() {
        const {
            data: { session },
            error
        } = await supabase.auth.getSession();

        if (error) {
            console.error(error);
            return;
        }

        currentUser = session?.user ?? null;

        await refreshUserInterface();
    }

    async function register(email, password) {
        const username = email.split("@")[0];

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username
                }
            }
        });

        if (error) {
            throw error;
        }

        showToast("注册成功！请按照提示完成邮箱验证。");
    }

    async function login(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        closeDialog("auth-dialog");

        showToast("登录成功！");

        await refreshSession();
        await loadBooks();
    }

    async function logout() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            showToast(error.message);
            return;
        }

        currentUser = null;
        currentProfile = null;

        await refreshUserInterface();

        showToast("已经退出登录。");
    }

    function openAuth(mode = "login") {
        const dialog = $("auth-dialog");

        if (!dialog) return;

        dialog.dataset.mode = mode;

        const title = $("auth-title");
        const description = $("auth-description");
        const submit = $("auth-submit");
        const switchButton = $("auth-switch");

        if (mode === "register") {
            if (title) title.textContent = "创建账号";
            if (description) description.textContent = "加入 NovelVerse";
            if (submit) submit.textContent = "注册";
            if (switchButton) switchButton.textContent = "已有账号？登录";
        } else {
            if (title) title.textContent = "欢迎回来";
            if (description) description.textContent = "登录你的 NovelVerse 账号";
            if (submit) submit.textContent = "登录";
            if (switchButton) switchButton.textContent = "没有账号？注册";
        }

        dialog.showModal();
    }

    function closeDialog(id) {
        const dialog = $(id);

        if (dialog?.open) {
            dialog.close();
        }
    }

    // =================================================
    // 4. USER PROFILE
    // =================================================

    async function loadProfile() {
        if (!currentUser) {
            currentProfile = null;
            return;
        }

        const { data, error } = await supabase.rpc(
            "get_my_profile"
        );

        if (error) {
            console.error("Profile error:", error);
            return;
        }

        currentProfile = data;

        updateProfileUI();
    }

    function updateProfileUI() {
        const points = currentProfile?.points ?? 0;

        if ($("points-balance")) {
            $("points-balance").textContent = points;
        }

        const adminPanel = $("admin-panel");

        if (adminPanel) {
            adminPanel.hidden =
                currentProfile?.role !== "admin";
        }
    }

    async function refreshUserInterface() {
        const loginButton = $("login-open");
        const registerButton = $("register-open");
        const logoutButton = $("logout-button");

        if (loginButton) {
            loginButton.hidden = !!currentUser;
        }

        if (registerButton) {
            registerButton.hidden = !!currentUser;
        }

        if (logoutButton) {
            logoutButton.hidden = !currentUser;
        }

        if (currentUser) {
            await loadProfile();
        } else {
            currentProfile = null;

            if ($("points-balance")) {
                $("points-balance").textContent = "0";
            }

            if ($("admin-panel")) {
                $("admin-panel").hidden = true;
            }
        }

        updateProfileUI();
    }

    // =================================================
    // 5. BOOK DATABASE
    // =================================================

    async function loadBooks() {
        const { data, error } = await supabase
            .from("books")
            .select("*")
            .eq("is_public", true)
            .eq("is_removed", false)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error("Books error:", error);
            showToast("无法加载小说：" + error.message);
            return;
        }

        books = data ?? [];

        updateBookCount();
        renderBooks();
    }

    function updateBookCount() {
        if ($("book-count")) {
            $("book-count").textContent = books.length;
        }

        if ($("reader-count")) {
            $("reader-count").textContent =
                books.reduce((sum, book) => sum + (book.views || 0), 0);
        }
    }

    // =================================================
    // 6. SEARCH AND FILTER
    // =================================================

    function getFilteredBooks() {
        const keyword = $("search-input")?.value
            .trim()
            .toLowerCase() ?? "";

        const category = $("category-filter")?.value ?? "all";

        const sort = $("sort-filter")?.value ?? "latest";

        let result = books.filter(book => {
            const matchesKeyword =
                !keyword ||
                book.title.toLowerCase().includes(keyword) ||
                book.author.toLowerCase().includes(keyword);

            const matchesCategory =
                category === "all" ||
                book.category === category;

            return matchesKeyword && matchesCategory;
        });

        if (sort === "popular") {
            result.sort((a, b) => b.views - a.views);
        }

        if (sort === "latest") {
            result.sort(
                (a, b) =>
                    new Date(b.created_at) -
                    new Date(a.created_at)
            );
        }

        if (sort === "title") {
            result.sort((a, b) =>
                a.title.localeCompare(b.title)
            );
        }

        return result;
    }

    // =================================================
    // 7. BOOK DISPLAY
    // =================================================

    function renderBooks() {
        const grid = $("book-grid");

        if (!grid) return;

        const result = getFilteredBooks();

        if (result.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>暂时没有找到小说 📚</h3>
                    <p>试试其他关键词或分类。</p>
                </div>
            `;

            return;
        }

        grid.innerHTML = result.map(book => {
            const cover = book.cover_path
                ? supabase.storage
                    .from("book-covers")
                    .getPublicUrl(book.cover_path).data.publicUrl
                : "";

            return `
                <article class="book-card">

                    <div class="book-cover">
                        ${
                            cover
                            ? `<img src="${escapeHTML(cover)}"
                                   alt="小说封面"
                                   loading="lazy">`
                            : `<div class="cover-placeholder">📖</div>`
                        }
                    </div>

                    <div class="book-card-content">

                        <span class="book-category">
                            ${escapeHTML(book.category)}
                        </span>

                        <h3>${escapeHTML(book.title)}</h3>

                        <p>作者：${escapeHTML(book.author)}</p>

                        <p class="book-description">
                            ${escapeHTML(book.description || "暂无简介")}
                        </p>

                        <p>👁 ${book.views || 0} 次阅读</p>

                        <button
                            class="primary-button"
                            data-read-book="${book.id}">
                            开始阅读
                        </button>

                    </div>

                </article>
            `;
        }).join("");
    }

    // =================================================
    // 8. BOOK UPLOAD
    // =================================================

    async function uploadBook(event) {
        event.preventDefault();

        if (!currentUser) {
            showToast("请先登录！");
            openAuth("login");
            return;
        }

        if (currentProfile?.is_banned) {
            showToast("当前账号无法上传作品。");
            return;
        }

        const title = $("book-title")?.value.trim();
        const category = $("book-category")?.value;
        const description = $("book-description")?.value.trim();

        const coverFile = $("book-cover")?.files[0];
        const bookFile = $("book-file")?.files[0];

        const agreement = $("upload-agreement");

        if (!title || !category || !bookFile) {
            setMessage(
                "upload-message",
                "请填写标题、分类并选择小说文件。"
            );
            return;
        }

        if (agreement && !agreement.checked) {
            setMessage(
                "upload-message",
                "请先确认你拥有上传作品的权利。"
            );
            return;
        }

        const extension = getExtension(bookFile.name);

        if (!["txt", "pdf", "epub"].includes(extension)) {
            setMessage(
                "upload-message",
                "目前只允许 TXT、PDF、EPUB 文件。"
            );
            return;
        }

        if (bookFile.size > config.MAX_BOOK_SIZE) {
            setMessage(
                "upload-message",
                "小说文件不能超过 20 MB。"
            );
            return;
        }

        if (coverFile && coverFile.size > config.MAX_COVER_SIZE) {
            setMessage(
                "upload-message",
                "封面不能超过 5 MB。"
            );
            return;
        }

        const allowedCoverTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (coverFile && !allowedCoverTypes.includes(coverFile.type)) {
            setMessage(
                "upload-message",
                "封面只支持 JPG、PNG、WEBP。"
            );
            return;
        }

        const button = event.submitter;

        if (button) button.disabled = true;

        try {
            const bookId = crypto.randomUUID();

            const filePath =
                `${currentUser.id}/${bookId}.${extension}`;

            // Upload book file
            const { error: fileError } = await supabase.storage
                .from("book-files")
                .upload(filePath, bookFile, {
                    upsert: false,
                    contentType: bookFile.type ||
                        "application/octet-stream"
                });

            if (fileError) throw fileError;

            let coverPath = null;

            // Upload cover
            if (coverFile) {
                const coverExtension = getExtension(coverFile.name);

                coverPath =
                    `${currentUser.id}/${bookId}.${coverExtension}`;

                const { error: coverError } = await supabase.storage
                    .from("book-covers")
                    .upload(coverPath, coverFile, {
                        upsert: false
                    });

                if (coverError) throw coverError;
            }

            // Insert book record
            const bookData = {
                id: bookId,
                uploader_id: currentUser.id,
                title,
                author: currentProfile?.username || "匿名作者",
                category,
                description,
                file_path: filePath,
                file_type: extension,
                cover_path: coverPath,
                read_price: Number($("read-price")?.value || 10),
                offline_price: Number($("offline-price")?.value || 200),
                download_price: Number($("download-price")?.value || 2000),
                is_public: true,
                is_removed: false
            };

            const { error: insertError } = await supabase
                .from("books")
                .insert(bookData);

            if (insertError) throw insertError;

            $("upload-form").reset();

            setMessage(
                "upload-message",
                "上传成功！你的小说已经公开。",
                true
            );

            showToast("🎉 小说上传成功！");

            await loadBooks();

        } catch (error) {
            console.error(error);

            setMessage(
                "upload-message",
                "上传失败：" + error.message
            );

        } finally {
            if (button) button.disabled = false;
        }
    }

    // =================================================
    // 9. BOOK READING
    // =================================================

    async function openBook(bookId) {
        if (!currentUser) {
            showToast("请登录后阅读小说。");
            openAuth("login");
            return;
        }

        const book = books.find(item => item.id === bookId);

        if (!book) {
            showToast("找不到这本小说。");
            return;
        }

        currentBook = book;

        const dialog = $("reader-dialog");

        if (!dialog) return;

        if ($("reader-title")) {
            $("reader-title").textContent = book.title;
        }

        const content = $("reader-content");

        if (content) {
            content.innerHTML = "<p>正在加载小说……</p>";
        }

        dialog.showModal();

        try {
            const { data, error } = await supabase.storage
                .from("book-files")
                .createSignedUrl(book.file_path, 300);

            if (error) throw error;

            const fileURL = data.signedUrl;

            if (book.file_type === "txt") {
                const response = await fetch(fileURL);

                if (!response.ok) {
                    throw new Error("无法读取小说文件。");
                }

                const text = await response.text();

                if (content) {
                    const paragraph = document.createElement("pre");

                    paragraph.className = "reader-text";
                    paragraph.textContent = text;

                    content.replaceChildren(paragraph);
                }

            } else if (book.file_type === "pdf") {
                if (content) {
                    content.innerHTML = `
                        <p>PDF 小说将在新标签页打开。</p>
                        <a href="${escapeHTML(fileURL)}"
                           target="_blank"
                           rel="noopener noreferrer">
                           打开 PDF
                        </a>
                    `;
                }

                window.open(fileURL, "_blank", "noopener");

            } else {
                if (content) {
                    content.innerHTML = `
                        <p>EPUB 在线阅读器暂未加入 1.0 版本。</p>
                        <p>我们会在后续版本支持 EPUB。</p>
                    `;
                }
            }

            // Increase view count
            // Note: This is best-effort and will be replaced
            // by a server-side RPC in a later version.

        } catch (error) {
            console.error(error);

            if (content) {
                content.textContent =
                    "加载失败：" + error.message;
            }
        }
    }

    // =================================================
    // 10. DAILY CHECK-IN
    // =================================================

    async function dailyCheckin() {
        if (!currentUser) {
            showToast("请先登录！");
            openAuth("login");
            return;
        }

        const button = $("checkin-button");

        if (button) button.disabled = true;

        try {
            const { data, error } = await supabase.rpc(
                "daily_checkin"
            );

            if (error) throw error;

            if (!data.success) {
                setMessage("checkin-message", data.message);
                return;
            }

            setMessage(
                "checkin-message",
                `签到成功！获得 ${data.reward} 积分！`,
                true
            );

            showToast(`🎉 +${data.reward} 积分`);

            await loadProfile();

        } catch (error) {
            console.error(error);

            setMessage(
                "checkin-message",
                "签到失败：" + error.message
            );

        } finally {
            if (button) button.disabled = false;
        }
    }

    // =================================================
    // 11. POINT HISTORY
    // =================================================

    async function loadPointHistory() {
        if (!currentUser) return;

        const { data, error } = await supabase
            .from("point_ledger")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", {
                ascending: false
            })
            .limit(30);

        if (error) {
            console.error(error);
            return;
        }

        const container = $("point-ledger");

        if (!container) return;

        if (!data.length) {
            container.textContent = "暂时没有积分记录。";
            return;
        }

        container.innerHTML = data.map(item => `
            <div class="ledger-item">
                <span>${escapeHTML(item.reason)}</span>
                <strong>
                    ${item.amount > 0 ? "+" : ""}
                    ${item.amount}
                </strong>
                <small>${formatDate(item.created_at)}</small>
            </div>
        `).join("");
    }

    // =================================================
    // 12. BOOKSHELF
    // =================================================

    async function loadBookshelf() {
        const container = $("bookshelf-content");

        if (!container) return;

        if (!currentUser) {
            container.textContent = "请登录后查看书架。";
            return;
        }

        const { data, error } = await supabase
            .from("books")
            .select("*")
            .eq("uploader_id", currentUser.id)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error(error);
            container.textContent = "无法加载书架。";
            return;
        }

        if (!data.length) {
            container.textContent = "你还没有上传小说。";
            return;
        }

        container.innerHTML = data.map(book => `
            <div class="bookshelf-item">
                <strong>${escapeHTML(book.title)}</strong>
                <span>
                    ${book.is_removed ? "已下架" : "已发布"}
                </span>
            </div>
        `).join("");
    }

    // =================================================
    // 13. ADMIN
    // =================================================

    async function adminRefresh() {
        if (currentProfile?.role !== "admin") {
            showToast("没有管理员权限。");
            return;
        }

        const { data, error } = await supabase
            .from("books")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (error) {
            showToast("无法加载管理列表：" + error.message);
            return;
        }

        const container = $("admin-book-list");

        if (!container) return;

        container.innerHTML = data.map(book => `
            <div class="admin-book-item">
                <strong>${escapeHTML(book.title)}</strong>

                <span>
                    ${book.is_removed ? "已下架" : "正常"}
                </span>

                <button
                    data-admin-remove="${book.id}"
                    ${book.is_removed ? "disabled" : ""}>
                    下架
                </button>
            </div>
        `).join("");
    }

    // =================================================
    // 14. THEMES
    // =================================================

    const themes = {
        default: {
            "--page-bg": "#eaf5f2",
            "--surface-bg": "#ffffff",
            "--surface-secondary": "#e5f2ef",
            "--text-color": "#173c3b",
            "--muted-color": "#66817e",
            "--accent-color": "#26a875",
            "--accent-secondary": "#378bd4",
            "--border-color": "#cfe2dd"
        },

        teal: {
            "--page-bg": "#d1eeea",
            "--surface-bg": "#f3fffd",
            "--surface-secondary": "#d1eeea",
            "--text-color": "#164b4b",
            "--muted-color": "#527b78",
            "--accent-color": "#008f83",
            "--accent-secondary": "#36a9bb",
            "--border-color": "#a8d8d1"
        },

        purple: {
            "--page-bg": "#f1eaff",
            "--surface-bg": "#ffffff",
            "--surface-secondary": "#e8ddff",
            "--text-color": "#39265e",
            "--muted-color": "#786b96",
            "--accent-color": "#8054d8",
            "--accent-secondary": "#aa70e8",
            "--border-color": "#ded0fa"
        },

        pink: {
            "--page-bg": "#fff0f5",
            "--surface-bg": "#ffffff",
            "--surface-secondary": "#ffe0eb",
            "--text-color": "#63354a",
            "--muted-color": "#987184",
            "--accent-color": "#e45d98",
            "--accent-secondary": "#f28cb5",
            "--border-color": "#f4ccdc"
        },

        red: {
            "--page-bg": "#fff0ef",
            "--surface-bg": "#ffffff",
            "--surface-secondary": "#ffe0dc",
            "--text-color": "#632c2c",
            "--muted-color": "#987070",
            "--accent-color": "#dc4848",
            "--accent-secondary": "#f08070",
            "--border-color": "#f3ceca"
        },

        white: {
            "--page-bg": "#ffffff",
            "--surface-bg": "#ffffff",
            "--surface-secondary": "#f5f5f5",
            "--text-color": "#202020",
            "--muted-color": "#777777",
            "--accent-color": "#555555",
            "--accent-secondary": "#888888",
            "--border-color": "#dddddd"
        },

        black: {
            "--page-bg": "#15191f",
            "--surface-bg": "#202630",
            "--surface-secondary": "#2a3440",
            "--text-color": "#f1f5f9",
            "--muted-color": "#a7b1bd",
            "--accent-color": "#52c99b",
            "--accent-secondary": "#60a5fa",
            "--border-color": "#3b4653"
        },

        sky: {
            "--page-bg": "#eaf5ff",
            "--surface-bg": "#ffffff",
            "--surface-secondary": "#dceeff",
            "--text-color": "#244466",
            "--muted-color": "#6d88a5",
            "--accent-color": "#3998e8",
            "--accent-secondary": "#63b8f2",
            "--border-color": "#c5def4"
        }
    };

    function applyTheme(name) {
        const theme = themes[name];

        if (!theme) return;

        Object.entries(theme).forEach(([key, value]) => {
            document.documentElement.style.setProperty(
                key,
                value
            );
        });

        localStorage.setItem("novelverse-theme", name);
    }

    function applyCustomColor(color) {
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
            return;
        }

        document.documentElement.style.setProperty(
            "--accent-color",
            color
        );

        document.documentElement.style.setProperty(
            "--accent-secondary",
            color
        );

        localStorage.setItem(
            "novelverse-custom-color",
            color
        );

        localStorage.setItem(
            "novelverse-theme",
            "custom"
        );
    }

    function initializeThemes() {
        const savedTheme =
            localStorage.getItem("novelverse-theme") || "default";

        if (savedTheme === "custom") {
            const color =
                localStorage.getItem("novelverse-custom-color");

            if (color) applyCustomColor(color);
        } else {
            applyTheme(savedTheme);
        }

        // Theme controls are added automatically
        // so the existing HTML does not need to be rebuilt.

        if ($("theme-select")) return;

        const header = document.querySelector("header");

        if (!header) return;

        const wrapper = document.createElement("div");

        wrapper.className = "theme-settings";

        wrapper.innerHTML = `
            <label for="theme-select">🎨 主题</label>

            <select id="theme-select">
                <option value="default">绿色 + 蓝色</option>
                <option value="teal">Teal</option>
                <option value="purple">紫色</option>
                <option value="pink">粉红色</option>
                <option value="red">红色</option>
                <option value="white">白色</option>
                <option value="black">黑色</option>
                <option value="sky">天空蓝</option>
            </select>

            <input
                type="color"
                id="custom-color"
                value="#26a875"
                title="自定义颜色">
        `;

        header.appendChild(wrapper);

        $("theme-select").value =
            savedTheme === "custom" ? "default" : savedTheme;

        $("custom-color").addEventListener(
            "input",
            event => applyCustomColor(event.target.value)
        );

        $("theme-select").addEventListener(
            "change",
            event => applyTheme(event.target.value)
        );
    }

    // =================================================
    // 15. EVENT LISTENERS
    // =================================================

    function initializeEvents() {

        $("login-open")?.addEventListener(
            "click",
            () => openAuth("login")
        );

        $("register-open")?.addEventListener(
            "click",
            () => openAuth("register")
        );

        $("logout-button")?.addEventListener(
            "click",
            logout
        );

        $("auth-close")?.addEventListener(
            "click",
            () => closeDialog("auth-dialog")
        );

        $("reader-close")?.addEventListener(
            "click",
            () => closeDialog("reader-dialog")
        );

        $("auth-switch")?.addEventListener(
            "click",
            () => {
                const mode = $("auth-dialog").dataset.mode;

                openAuth(
                    mode === "login" ? "register" : "login"
                );
            }
        );

        $("auth-form")?.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const email = $("auth-email").value.trim();
                const password = $("auth-password").value;

                const mode = $("auth-dialog").dataset.mode;

                try {
                    if (mode === "register") {
                        await register(email, password);
                    } else {
                        await login(email, password);
                    }

                } catch (error) {
                    setMessage(
                        "auth-message",
                        error.message
                    );
                }
            }
        );

        $("search-input")?.addEventListener(
            "input",
            renderBooks
        );

        $("category-filter")?.addEventListener(
            "change",
            renderBooks
        );

        $("sort-filter")?.addEventListener(
            "change",
            renderBooks
        );

        $("upload-form")?.addEventListener(
            "submit",
            uploadBook
        );

        $("checkin-button")?.addEventListener(
            "click",
            dailyCheckin
        );

        $("admin-refresh")?.addEventListener(
            "click",
            adminRefresh
        );

        $("book-grid")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest(
                    "[data-read-book]"
                );

                if (button) {
                    openBook(button.dataset.readBook);
                }
            }
        );

        $("admin-book-list")?.addEventListener(
            "click",
            async event => {
                const button = event.target.closest(
                    "[data-admin-remove]"
                );

                if (!button) return;

                if (currentProfile?.role !== "admin") {
                    showToast("没有管理员权限。");
                    return;
                }

                const id = button.dataset.adminRemove;

                const { error } = await supabase
                    .from("books")
                    .update({
                        is_removed: true
                    })
                    .eq("id", id);

                if (error) {
                    showToast("下架失败：" + error.message);
                    return;
                }

                showToast("小说已下架。");

                await loadBooks();
                await adminRefresh();
            }
        );

        $("reader-complete")?.addEventListener(
            "click",
            () => {
                showToast(
                    "完读奖励功能将在下一版本启用。"
                );
            }
        );
    }

    // =================================================
    // 16. START APPLICATION
    // =================================================

    async function startApplication() {
        initializeThemes();
        initializeEvents();

        await refreshSession();
        await loadBooks();

        if (currentUser) {
            await loadPointHistory();
            await loadBookshelf();
        }

        supabase.auth.onAuthStateChange(
            async (_event, session) => {
                currentUser = session?.user ?? null;

                await refreshUserInterface();

                if (currentUser) {
                    await loadPointHistory();
                    await loadBookshelf();
                }
            }
        );

        console.log(
            "📚 NovelVerse 1.0 started successfully!"
        );
    }

    document.addEventListener(
        "DOMContentLoaded",
        startApplication
    );

})();