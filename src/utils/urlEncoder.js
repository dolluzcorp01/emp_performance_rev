export const encodeFormUrl = (formId, pageId) => {
    const data = JSON.stringify({ formId, pageId });
    return btoa(data); // Base64 encode
};

export const decodeFormUrl = (encoded) => {
    try {
        const decoded = atob(encoded);
        return JSON.parse(decoded);
    } catch (err) {
        return null;
    }
};