import client from "../client";

export const uploadApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return client.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
