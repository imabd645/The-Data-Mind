// Global variables
let currentUser = null;
let posts = [];
let currentPost = null;

// DOM elements
const postsContainer = document.getElementById('posts-container');
const loading = document.getElementById('loading');
const noPosts = document.getElementById('no-posts');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const postModal = document.getElementById('post-modal');
const commentModal = document.getElementById('comment-modal');
const modalContent = document.getElementById('modal-content');
const commentContent = document.getElementById('comment-content');
const profileLink = document.getElementById('profile-link');
const loginLink = document.getElementById('login-link');
const signupLink = document.getElementById('signup-link');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize the application
function initializeApp() {
    // Check authentication state
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        updateNavigation();
        if (user) {
            loadPosts();
        } else {
            loadPosts(); // Load posts for non-authenticated users too
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Modal close events
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            postModal.style.display = 'none';
            commentModal.style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === postModal) {
            postModal.style.display = 'none';
        }
        if (e.target === commentModal) {
            commentModal.style.display = 'none';
        }
    });

    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
}

// Update navigation based on authentication
function updateNavigation() {
    if (currentUser) {
        profileLink.style.display = 'inline';
        loginLink.style.display = 'none';
        signupLink.style.display = 'none';
    } else {
        profileLink.style.display = 'none';
        loginLink.style.display = 'inline';
        signupLink.style.display = 'inline';
    }
}

// Load posts from Firestore
async function loadPosts(searchTerm = '') {
    try {
        loading.style.display = 'block';
        noPosts.style.display = 'none';
        postsContainer.innerHTML = '';

        let query = db.collection('posts').orderBy('createdAt', 'desc');
        let postsSnapshot;
        if (searchTerm) {
            // For search, always fetch fresh from server
            // Fetch all posts and filter client-side for better matching
            postsSnapshot = await query.get({ source: 'server' });
            posts = [];
            const keywords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
            postsSnapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data() };
                const haystack = [post.title, post.content, post.authorName].map(x => (x || '').toLowerCase()).join(' ');
                if (keywords.every(word => haystack.includes(word))) {
                    posts.push(post);
                }
            });
        } else {
            // For no search, try cache first
            const cacheKey = 'all_posts';
            const cached = cache.get(cacheKey);
            if (cached && Array.isArray(cached)) {
                posts = cached;
            } else {
                // Cache miss, fetch from Firestore
                postsSnapshot = await query.get({ source: 'server' });
                posts = [];
                postsSnapshot.forEach(doc => {
                    const post = { id: doc.id, ...doc.data() };
                    posts.push(post);
                });
                // Cache for 30 minutes
                cache.set(cacheKey, posts, 1000 * 60 * 30);
            }
        }

        if (posts.length === 0) {
            noPosts.style.display = 'block';
        } else {
            renderPosts(posts);
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        showError('Failed to load posts. Please try again.');
    } finally {
        loading.style.display = 'none';
    }
}

// Render posts
function renderPosts(postsToRender) {
    postsContainer.innerHTML = '';
    
    postsToRender.forEach(post => {
        const postElement = createPostElement(post);
        postsContainer.appendChild(postElement);
    });
}

// Create post element
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post-card';
    
    const authorInitials = getAuthorInitials(post.authorName);
    const formattedDate = formatDate(post.createdAt);
    
    postDiv.innerHTML = `
        <div class="post-header">
            <div class="author-avatar">${authorInitials}</div>
            <div class="author-info">
                <h4 class="author-name" data-author="${post.authorName}">${post.authorName}</h4>
                <span class="post-date">${formattedDate}</span>
            </div>
        </div>
        <h3 class="post-title" data-post-id="${post.id}">${post.title}</h3>
        <p class="post-content">${truncateText(post.content, 200)}</p>
        <div class="post-stats">
            <div class="stats-left">
                <div class="stat-item">
                    <i class="fas fa-eye"></i>
                    <span>${post.views || 0}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-heart"></i>
                    <span>${post.likes || 0}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-comment"></i>
                    <span>${post.commentCount || 0}</span>
                </div>
            </div>
            <div class="post-actions">
                <button class="action-btn share-btn" onclick="sharePost('${post.id}')">
                    <i class="fas fa-share"></i>
                    Share
                </button>
            </div>
        </div>
    `;

    // Add click event for post title
    const titleElement = postDiv.querySelector('.post-title');
    titleElement.addEventListener('click', () => {
        window.location.href = `post.html?id=${post.id}`;
    });

    // Add click event for author name
    const authorElement = postDiv.querySelector('.author-name');
    authorElement.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `user.html?author=${encodeURIComponent(post.authorName)}`;
    });

    return postDiv;
}

// Handle search
function handleSearch() {
    const searchTerm = searchInput.value.trim();
    loadPosts(searchTerm);
}

// Open post detail
async function openPostDetail(postId) {
    try {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        currentPost = post;
        
        // Increment view count
        await incrementViewCount(postId);
        
        // Update post data
        post.views = (post.views || 0) + 1;
        
        // Render post detail
        renderPostDetail(post);
        postModal.style.display = 'block';
    } catch (error) {
        console.error('Error opening post:', error);
        showError('Failed to open post. Please try again.');
    }
}

// Render post detail
function renderPostDetail(post) {
    const authorInitials = getAuthorInitials(post.authorName);
    const formattedDate = formatDate(post.createdAt);
    
    modalContent.innerHTML = `
        <div class="post-detail">
            <div class="post-header">
                <div class="author-avatar">${authorInitials}</div>
                <div class="author-info">
                    <h4 class="author-name" onclick="openUserProfile('${post.authorName}')">${post.authorName}</h4>
                    <span class="post-date">${formattedDate}</span>
                </div>
            </div>
            <h2 class="post-title">${post.title}</h2>
            <div class="post-content">${post.content}</div>
            <div class="post-stats">
                <div class="stats-left">
                    <div class="stat-item">
                        <i class="fas fa-eye"></i>
                        <span>${post.views || 0}</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-heart"></i>
                        <span>${post.likes || 0}</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-comment"></i>
                        <span>${post.commentCount || 0}</span>
                    </div>
                </div>
                <div class="post-actions">
                    <button class="action-btn like-btn ${post.likedBy && post.likedBy.includes(currentUser?.uid) ? 'liked' : ''}" 
                            onclick="toggleLike('${post.id}')">
                        <i class="fas fa-heart"></i>
                        Like
                    </button>
                    <button class="action-btn share-btn" onclick="sharePost('${post.id}')">
                        <i class="fas fa-share"></i>
                        Share
                    </button>
                </div>
            </div>
            <div class="comments-section">
                <div class="comments-header">
                    <h3>Comments (${post.commentCount || 0})</h3>
                </div>
                ${currentUser ? `
                    <div class="comment-form">
                        <textarea class="comment-input" id="comment-input" placeholder="Write a comment..."></textarea>
                        <button class="comment-submit" onclick="addComment('${post.id}')">Post Comment</button>
                    </div>
                ` : '<p>Please <a href="login.html">login</a> to comment.</p>'}
                <div class="comments-list" id="comments-list">
                    <!-- Comments will be loaded here -->
                </div>
            </div>
        </div>
    `;

    // Load comments
    loadComments(post.id);
}

// Load comments
async function loadComments(postId) {
    try {
        const commentsList = document.getElementById('comments-list');
        const snapshot = await db.collection('posts').doc(postId).collection('comments').orderBy('createdAt', 'desc').get();
        
        commentsList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const comment = { id: doc.id, ...doc.data() };
            const commentElement = createCommentElement(comment, postId);
            commentsList.appendChild(commentElement);
        });
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// Create comment element
function createCommentElement(comment, postId) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    
    const authorInitials = getAuthorInitials(comment.authorName);
    const formattedDate = formatDate(comment.createdAt);
    const isAuthor = currentUser && comment.authorId === currentUser.uid;
    
    commentDiv.innerHTML = `
        <div class="comment-header">
            <div class="author-info">
                <span class="comment-author" onclick="openUserProfile('${comment.authorName}')">${comment.authorName}</span>
                <span class="comment-date">${formattedDate}</span>
            </div>
            ${isAuthor ? `
                <div class="comment-actions">
                    <button class="comment-action" onclick="editComment('${postId}', '${comment.id}')">Edit</button>
                    <button class="comment-action" onclick="deleteComment('${postId}', '${comment.id}')">Delete</button>
                </div>
            ` : ''}
        </div>
        <div class="comment-content" id="comment-content-${comment.id}">${comment.content}</div>
        <div class="comment-actions">
            <button class="comment-action" onclick="toggleReplyForm('${postId}', '${comment.id}')">Reply</button>
            ${comment.replyCount > 0 ? `
                <button class="comment-action" onclick="toggleReplies('${postId}', '${comment.id}')">
                    ${comment.replyCount} replies
                </button>
            ` : ''}
        </div>
        <div class="reply-form" id="reply-form-${comment.id}" style="display: none;">
            <textarea class="reply-input" id="reply-input-${comment.id}" placeholder="Write a reply..."></textarea>
            <button class="reply-submit" onclick="addReply('${postId}', '${comment.id}')">Reply</button>
        </div>
        <div class="replies" id="replies-${comment.id}" style="display: none;">
            <!-- Replies will be loaded here -->
        </div>
    `;

    return commentDiv;
}

// Add comment
async function addComment(postId) {
    if (!currentUser) {
        showError('Please login to comment.');
        return;
    }

    const commentInput = document.getElementById('comment-input');
    const content = commentInput.value.trim();
    
    if (!content) {
        showError('Please enter a comment.');
        return;
    }

    try {
        const commentData = {
            content: content,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email.split('@')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            replyCount: 0
        };

        await db.collection('posts').doc(postId).collection('comments').add(commentData);
        
        // Update comment count
        await db.collection('posts').doc(postId).update({
            commentCount: firebase.firestore.FieldValue.increment(1)
        });

        commentInput.value = '';
        loadComments(postId);
        
        // Update post data
        currentPost.commentCount = (currentPost.commentCount || 0) + 1;
        updatePostStats();
    } catch (error) {
        console.error('Error adding comment:', error);
        showError('Failed to add comment. Please try again.');
    }
}

// Add reply
async function addReply(postId, commentId) {
    if (!currentUser) {
        showError('Please login to reply.');
        return;
    }

    const replyInput = document.getElementById(`reply-input-${commentId}`);
    const content = replyInput.value.trim();
    
    if (!content) {
        showError('Please enter a reply.');
        return;
    }

    try {
        const replyData = {
            content: content,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email.split('@')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            parentCommentId: commentId
        };

        await db.collection('posts').doc(postId).collection('comments').doc(commentId).collection('replies').add(replyData);
        
        // Update reply count
        await db.collection('posts').doc(postId).collection('comments').doc(commentId).update({
            replyCount: firebase.firestore.FieldValue.increment(1)
        });

        replyInput.value = '';
        toggleReplyForm(postId, commentId);
        loadReplies(postId, commentId);
    } catch (error) {
        console.error('Error adding reply:', error);
        showError('Failed to add reply. Please try again.');
    }
}

// Toggle reply form
function toggleReplyForm(postId, commentId) {
    const replyForm = document.getElementById(`reply-form-${commentId}`);
    replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
}

// Toggle replies
async function toggleReplies(postId, commentId) {
    const repliesDiv = document.getElementById(`replies-${commentId}`);
    
    if (repliesDiv.style.display === 'none') {
        repliesDiv.style.display = 'block';
        await loadReplies(postId, commentId);
    } else {
        repliesDiv.style.display = 'none';
    }
}

// Load replies
async function loadReplies(postId, commentId) {
    try {
        const repliesDiv = document.getElementById(`replies-${commentId}`);
        const snapshot = await db.collection('posts').doc(postId).collection('comments').doc(commentId).collection('replies').orderBy('createdAt', 'asc').get({ source: 'server' });
        
        repliesDiv.innerHTML = '';
        
        snapshot.forEach(doc => {
            const reply = { id: doc.id, ...doc.data() };
            const replyElement = createReplyElement(reply, postId, commentId);
            repliesDiv.appendChild(replyElement);
        });
    } catch (error) {
        console.error('Error loading replies:', error);
    }
}

// Create reply element
function createReplyElement(reply, postId, commentId) {
    const replyDiv = document.createElement('div');
    replyDiv.className = 'comment';
    
    const formattedDate = formatDate(reply.createdAt);
    const isAuthor = currentUser && reply.authorId === currentUser.uid;
    
    replyDiv.innerHTML = `
        <div class="comment-header">
            <div class="author-info">
                <span class="comment-author" onclick="openUserProfile('${reply.authorName}')">${reply.authorName}</span>
                <span class="comment-date">${formattedDate}</span>
            </div>
            ${isAuthor ? `
                <div class="comment-actions">
                    <button class="comment-action" onclick="editReply('${postId}', '${commentId}', '${reply.id}')">Edit</button>
                    <button class="comment-action" onclick="deleteReply('${postId}', '${commentId}', '${reply.id}')">Delete</button>
                </div>
            ` : ''}
        </div>
        <div class="comment-content" id="reply-content-${reply.id}">${reply.content}</div>
    `;

    return replyDiv;
}

// Edit comment
function editComment(postId, commentId) {
    const contentDiv = document.getElementById(`comment-content-${commentId}`);
    const currentContent = contentDiv.textContent;
    
    contentDiv.innerHTML = `
        <textarea class="comment-input" id="edit-comment-${commentId}">${currentContent}</textarea>
        <button class="comment-submit" onclick="saveCommentEdit('${postId}', '${commentId}')">Save</button>
        <button class="comment-action" onclick="cancelCommentEdit('${commentId}')">Cancel</button>
    `;
}

// Save comment edit
async function saveCommentEdit(postId, commentId) {
    const editInput = document.getElementById(`edit-comment-${commentId}`);
    const newContent = editInput.value.trim();
    
    if (!newContent) {
        showError('Comment cannot be empty.');
        return;
    }

    try {
        await db.collection('posts').doc(postId).collection('comments').doc(commentId).update({
            content: newContent
        });
        
        loadComments(postId);
    } catch (error) {
        console.error('Error editing comment:', error);
        showError('Failed to edit comment. Please try again.');
    }
}

// Cancel comment edit
function cancelCommentEdit(commentId) {
    loadComments(currentPost.id);
}

// Delete comment
async function deleteComment(postId, commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }

    try {
        await db.collection('posts').doc(postId).collection('comments').doc(commentId).delete();
        
        // Update comment count
        await db.collection('posts').doc(postId).update({
            commentCount: firebase.firestore.FieldValue.increment(-1)
        });

        loadComments(postId);
        
        // Update post data
        currentPost.commentCount = Math.max(0, (currentPost.commentCount || 0) - 1);
        updatePostStats();
    } catch (error) {
        console.error('Error deleting comment:', error);
        showError('Failed to delete comment. Please try again.');
    }
}

// Edit reply
function editReply(postId, commentId, replyId) {
    const contentDiv = document.getElementById(`reply-content-${replyId}`);
    const currentContent = contentDiv.textContent;
    
    contentDiv.innerHTML = `
        <textarea class="reply-input" id="edit-reply-${replyId}">${currentContent}</textarea>
        <button class="reply-submit" onclick="saveReplyEdit('${postId}', '${commentId}', '${replyId}')">Save</button>
        <button class="comment-action" onclick="cancelReplyEdit('${replyId}')">Cancel</button>
    `;
}

// Save reply edit
async function saveReplyEdit(postId, commentId, replyId) {
    const editInput = document.getElementById(`edit-reply-${replyId}`);
    const newContent = editInput.value.trim();
    
    if (!newContent) {
        showError('Reply cannot be empty.');
        return;
    }

    try {
        await db.collection('posts').doc(postId).collection('comments').doc(commentId).collection('replies').doc(replyId).update({
            content: newContent
        });
        
        loadReplies(postId, commentId);
    } catch (error) {
        console.error('Error editing reply:', error);
        showError('Failed to edit reply. Please try again.');
    }
}

// Cancel reply edit
function cancelReplyEdit(replyId) {
    loadReplies(currentPost.id, currentPost.currentCommentId);
}

// Delete reply
async function deleteReply(postId, commentId, replyId) {
    if (!confirm('Are you sure you want to delete this reply?')) {
        return;
    }

    try {
        await db.collection('posts').doc(postId).collection('comments').doc(commentId).collection('replies').doc(replyId).delete();
        
        // Update reply count
        await db.collection('posts').doc(postId).collection('comments').doc(commentId).update({
            replyCount: firebase.firestore.FieldValue.increment(-1)
        });

        loadReplies(postId, commentId);
    } catch (error) {
        console.error('Error deleting reply:', error);
        showError('Failed to delete reply. Please try again.');
    }
}

// Toggle like
async function toggleLike(postId) {
    if (!currentUser) {
        showError('Please login to like posts.');
        return;
    }

    try {
        const postRef = db.collection('posts').doc(postId);
        const postDoc = await postRef.get();
        const postData = postDoc.data();
        
        const likedBy = postData.likedBy || [];
        const isLiked = likedBy.includes(currentUser.uid);
        
        if (isLiked) {
            // Unlike
            likedBy.splice(likedBy.indexOf(currentUser.uid), 1);
            await postRef.update({
                likes: firebase.firestore.FieldValue.increment(-1),
                likedBy: likedBy
            });
        } else {
            // Like
            likedBy.push(currentUser.uid);
            await postRef.update({
                likes: firebase.firestore.FieldValue.increment(1),
                likedBy: likedBy
            });
        }

        // Update UI
        const likeBtn = document.querySelector(`[data-post-id="${postId}"].like-btn`);
        if (likeBtn) {
            likeBtn.classList.toggle('liked');
            const likeCount = likeBtn.parentElement.previousElementSibling.querySelector('.stat-item:nth-child(2) span');
            const currentLikes = parseInt(likeCount.textContent);
            likeCount.textContent = isLiked ? currentLikes - 1 : currentLikes + 1;
        }

        // Update current post data
        if (currentPost && currentPost.id === postId) {
            currentPost.likes = isLiked ? (currentPost.likes || 1) - 1 : (currentPost.likes || 0) + 1;
            currentPost.likedBy = likedBy;
            updatePostStats();
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showError('Failed to update like. Please try again.');
    }
}

// Share post
function sharePost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const url = `${window.location.origin}/post.html?id=${postId}`;
    const text = `Check out this post: ${post.title}`;

    if (navigator.share) {
        navigator.share({
            title: post.title,
            text: text,
            url: url
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            showSuccess('Link copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showSuccess('Link copied to clipboard!');
        });
    }
}

// Increment view count
async function incrementViewCount(postId) {
    try {
        await db.collection('posts').doc(postId).update({
            views: firebase.firestore.FieldValue.increment(1)
        });
    } catch (error) {
        console.error('Error incrementing view count:', error);
    }
}

// Update post stats in modal
function updatePostStats() {
    if (!currentPost) return;
    
    const statsElements = document.querySelectorAll('.post-detail .stat-item span');
    if (statsElements.length >= 3) {
        statsElements[0].textContent = currentPost.views || 0;
        statsElements[1].textContent = currentPost.likes || 0;
        statsElements[2].textContent = currentPost.commentCount || 0;
    }
}

// Open user profile
function openUserProfile(authorName) {
    window.location.href = `user.html?author=${encodeURIComponent(authorName)}`;
}

// Utility functions
function getAuthorInitials(authorName) {
    if (!authorName) return '?';
    return authorName.split(' ').map(name => name.charAt(0)).join('').toUpperCase().substring(0, 2);
}

function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.insertBefore(successDiv, document.body.firstChild);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Cache invalidation helpers
function invalidatePostsCache() {
    cache.clear('all_posts');
}

function invalidateUserPostsCache(userId) {
    if (userId) cache.clear(`user_posts_${userId}`);
}

function invalidateAuthorPostsCache(authorName) {
    if (authorName) cache.clear(`posts_by_author_${authorName}`);
}

function invalidatePostDetailCache(postId) {
    if (postId) cache.clear(`post_${postId}`);
}

// Messaging utilities
async function sendMessageToUser(receiverId, content) {
  if (!currentUser || !content.trim()) return;
  await db.collection('messages').add({
    sender: currentUser.uid,
    receiver: receiverId,
    content: content.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}
async function fetchMessagesWithUser(otherUserId) {
  if (!currentUser) return [];
  const snapshot = await db.collection('messages')
    .where('sender', 'in', [currentUser.uid, otherUserId])
    .where('receiver', 'in', [currentUser.uid, otherUserId])
    .orderBy('createdAt', 'asc')
    .get({ source: 'server' });
  const messages = [];
  snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
  return messages;
}
function listenForMessagesWithUser(otherUserId, callback) {
  if (!currentUser) return;
  return db.collection('messages')
    .where('sender', 'in', [currentUser.uid, otherUserId])
    .where('receiver', 'in', [currentUser.uid, otherUserId])
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      const messages = [];
      snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
      callback(messages);
    });
}