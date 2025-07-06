function convertMarkdownToHTML(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

class LegalAssistantExtension {
  constructor() {
    this.educationMode = false;
    this.isLoading = false;
    this.messages = [];
    this.currentDocument = null;

    this.initializeElements();
    this.bindEvents();
    this.updateSuggestions();
    this.checkPageContent();
    this.loadStoredData();
  }

  initializeElements() {
    this.chatInterface = document.getElementById("chatInterface");
    this.messagesArea = document.getElementById("messagesArea");
    this.welcomeScreen = document.getElementById("welcomeScreen");
    this.chatForm = document.getElementById("chatForm");
    this.messageInput = document.getElementById("messageInput");
    this.sendBtn = document.getElementById("sendBtn");
    this.educationBtn = document.getElementById("educationBtn");
    this.educationBanner = document.getElementById("educationBanner");
    this.teachingBadge = document.getElementById("teachingBadge");
    this.suggestionsTitle = document.getElementById("suggestionsTitle");
    this.suggestionButtons = document.getElementById("suggestionButtons");
    this.documentName = document.getElementById("fileDropdown");
    this.documentBadge = document.getElementById("documentBadge");
    this.pageDetectionBadge = document.getElementById("pageDetectionBadge");
    this.fileInput = document.getElementById("fileInput");
    this.backArr = document.querySelector(".back-arr");

    // Upload elements
    this.setupFileUpload();
  }

  bindEvents() {
    this.educationBtn.addEventListener("click", () =>
      this.toggleEducationMode()
    );
    this.chatForm.addEventListener("submit", (e) => this.handleSubmit(e));

    // Suggestion buttons
    this.suggestionButtons.addEventListener("click", (e) => {
      if (e.target.classList.contains("suggestion-btn")) {
        const question = e.target.dataset.question;
        this.messageInput.value = question;
        this.handleSubmit(e);
      }
    });

    //back arrow button
    this.backArr.addEventListener("click", () => {
      this.showWelcomeScreen();
    });

    // upload file button
    this.fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) {
        this.addSystemMessage("No file selected.");
        return;
      }

      this.addSystemMessage(`Uploading "${file.name}"...`);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://localhost:5000/upload-file", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorData = {};
          try {
            errorData = await response.json();
          } catch (e) {
            console.error("Could not parse error response as JSON:", e);
          }
          this.addSystemMessage(
            `Error ${response.status}: ${errorData.error || "Upload failed."}`
          );
          return;
        }

        const data = await response.json();
        this.addMessage("assistant", `${data.summary}`);
      } catch (error) {
        console.error("Upload error:", error);
        this.addSystemMessage("An error occurred while uploading the file.");
      }
    });
  }

  async checkPageContent() {
    try {
      const [tab] = await window.chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Inject content script to check for legal documents
      const results = await window.chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // Check for legal document indicators
          const legalKeywords = [
            "contract",
            "agreement",
            "terms",
            "conditions",
            "legal",
            "privacy policy",
            "terms of service",
            "license",
            "copyright",
            "employment",
            "lease",
            "rental",
            "mortgage",
            "loan",
          ];

          const pageText = document.body.innerText.toLowerCase();
          const title = document.title.toLowerCase();

          const foundKeywords = legalKeywords.filter(
            (keyword) => pageText.includes(keyword) || title.includes(keyword)
          );

          if (foundKeywords.length > 0) {
            return {
              detected: true,
              title: document.title,
              url: window.location.href,
              keywords: foundKeywords,
              content: pageText.substring(0, 1000), // First 1000 chars
            };
          }

          return { detected: false };
        },
      });

      if (results[0].result.detected) {
        this.handlePageDetection(results[0].result);
      }
    } catch (error) {
      console.log("Could not check page content:", error);
    }
  }

  handlePageDetection(pageData) {
    this.documentName.value = pageData.title;
    this.documentBadge.classList.remove("hidden");
    this.pageDetectionBadge.classList.remove("hidden");

    // Store page context
    this.currentDocument = {
      type: "webpage",
      title: pageData.title,
      url: pageData.url,
      content: pageData.content,
      keywords: pageData.keywords,
    };

    // Add system message
    this.addSystemMessage(
      `Legal document detected: "${pageData.title}". I can help analyze this page.`
    );
  }

  setupFileUpload() {
    const uploadButton = document.getElementById("uploadButton");
    const fileInput = document.getElementById("fileInput");
    const uploadText = document.getElementById("uploadText");
    const uploadProgress = document.getElementById("uploadProgress");
    const documentStatus = document.getElementById("documentStatus");
    const statusText = document.getElementById("statusText");
    const fileName = document.getElementById("fileName");
    const removeFileBtn = document.getElementById("removeFileBtn");

    // File input change
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileUpload(file);
      }
    });

    // Drag and drop
    uploadButton.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadButton.classList.add("dragover");
    });

    uploadButton.addEventListener("dragleave", (e) => {
      e.preventDefault();
      uploadButton.classList.remove("dragover");
    });

    uploadButton.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadButton.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) {
        this.handleFileUpload(file);
      }
    });

    // Remove file
    removeFileBtn.addEventListener("click", () => {
      this.removeDocument();
    });
  }

  async handleFileUpload(file) {
    const uploadButton = document.getElementById("uploadButton");
    const fileInput = document.getElementById("fileInput");
    const uploadText = document.getElementById("uploadText");
    const uploadProgress = document.getElementById("uploadProgress");
    const documentStatus = document.getElementById("documentStatus");
    const statusText = document.getElementById("statusText");
    const fileName = document.getElementById("fileName");

    // Validate file type
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      this.showUploadError("Please upload a PDF, PNG, or JPEG file.");
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      this.showUploadError("File size must be less than 10MB.");
      return;
    }

    // Start upload simulation
    uploadButton.classList.add("uploading");
    fileInput.disabled = true;
    uploadText.textContent = "Processing...";

    // Read file content
    const fileContent = await this.readFileContent(file);

    // Simulate upload progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress > 100) progress = 100;
      uploadProgress.style.width = progress + "%";

      if (progress >= 100) {
        clearInterval(progressInterval);
        setTimeout(() => {
          this.completeUpload(file, fileContent);
        }, 500);
      }
    }, 200);
  }

  async readFileContent(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target.result);
      };

      if (file.type === "text/plain") {
        reader.readAsText(file);
      } else {
        // For PDF/DOC files, we'd normally use a library to extract text
        // For demo purposes, we'll just store the file info
        resolve(
          `[${file.type}] ${file.name} - Content extraction would require additional processing.`
        );
      }
    });
  }

  completeUpload(file, content) {
    const uploadButton = document.getElementById("uploadButton");
    const fileInput = document.getElementById("fileInput");
    const uploadText = document.getElementById("uploadText");
    const uploadProgress = document.getElementById("uploadProgress");
    const documentStatus = document.getElementById("documentStatus");
    const statusText = document.getElementById("statusText");
    const fileName = document.getElementById("fileName");

    // Reset upload button
    uploadButton.classList.remove("uploading");
    fileInput.disabled = false;
    uploadText.textContent = "Upload Another Document";
    uploadProgress.style.width = "0%";

    // Show success status
    documentStatus.classList.remove("hidden", "error");
    statusText.textContent = "Document uploaded and analyzed successfully";
    fileName.textContent = `${file.name} (${this.formatFileSize(file.size)})`;

    // Update document context
    this.currentDocument = {
      type: "upload",
      name: file.name,
      size: file.size,
      content: content,
    };

    this.documentName.add(new Option(file.name, file.name));
    this.documentName.value = file.name;
    this.documentBadge.classList.remove("hidden");

    // Store in extension storage
    this.saveDocumentToStorage();

    // Add system message
    this.addSystemMessage(
      `Document "${file.name}" has been uploaded and is now available for analysis.`
    );
    this.addSystemMessage("Summarizing legal file...");
  }

  showUploadError(message) {
    const documentStatus = document.getElementById("documentStatus");
    const statusText = document.getElementById("statusText");
    const fileName = document.getElementById("fileName");

    documentStatus.classList.remove("hidden");
    documentStatus.classList.add("error");
    statusText.textContent = message;
    fileName.textContent = "";

    // Hide error after 5 seconds
    setTimeout(() => {
      documentStatus.classList.add("hidden");
      documentStatus.classList.remove("error");
    }, 5000);
  }

  removeDocument() {
    const uploadText = document.getElementById("uploadText");
    const documentStatus = document.getElementById("documentStatus");
    const fileInput = document.getElementById("fileInput");

    uploadText.textContent = "Upload Legal Document";
    documentStatus.classList.add("hidden");
    fileInput.value = "";

    // Reset document context
    this.currentDocument = null;
    this.documentName.value = "No document loaded";
    this.documentBadge.classList.add("hidden");

    // Clear from storage
    window.chrome.storage.local.remove(["currentDocument"]);

    this.addSystemMessage(
      "Document has been removed. Upload a new document to continue analysis."
    );
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  }

  toggleEducationMode() {
    this.educationMode = !this.educationMode;

    if (this.educationMode) {
      this.educationBtn.classList.remove("inactive");
      this.educationBtn.classList.add("active");
      this.educationBtn.title = "Disable Education Mode";
      this.educationBanner.classList.remove("hidden");
      this.teachingBadge.classList.remove("hidden");
      this.messageInput.placeholder = "Ask about this legal document...";
    } else {
      this.educationBtn.classList.remove("active");
      this.educationBtn.classList.add("inactive");
      this.educationBtn.title = "Enable Education Mode";
      this.educationBanner.classList.add("hidden");
      this.teachingBadge.classList.add("hidden");
      this.messageInput.placeholder = "Ask about this legal document...";
    }

    this.updateSuggestions();
    this.saveSettings();
  }

  updateSuggestions() {
    const regularQuestions = [
      "What are the key terms in this document?",
      "Explain the termination clause",
      "Are there any potential red flags?",
      "What are my rights under this agreement?",
    ];

    const educationQuestions = [
      "Teach me about contract law basics",
      "How do termination clauses work in employment law?",
      "What should I know about non-compete agreements?",
      "Explain the legal concept of consideration",
    ];

    const questions = regularQuestions;
    const title = "Suggested questions:";

    this.suggestionsTitle.textContent = title;
    this.suggestionButtons.innerHTML = questions
      .map(
        (q) =>
          `<button class="suggestion-btn" data-question="${q}">${q}</button>`
      )
      .join("");
  }

  async handleSubmit(e) {
    e.preventDefault();

    const message = this.messageInput.value.trim();
    if (!message || this.isLoading) return;

    this.addMessage("user", message);
    this.messageInput.value = "";
    this.hideWelcomeScreen();
    this.setLoading(true);

    // Save message to storage
    this.saveMessagesToStorage();

    let doc_name = document.getElementById('fileDropdown').value;
    const response = await this.generateResponse(message, doc_name, this.educationMode);
    this.addMessage("assistant", response);
    this.setLoading(false);
    this.saveMessagesToStorage();
  }

  addMessage(role, content) {
    this.messages.push({ role, content, timestamp: Date.now() });

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "message-bubble";

    content = convertMarkdownToHTML(content);

    if (role === "assistant") {
      const headerDiv = document.createElement("div");
      headerDiv.className = "assistant-header";
      headerDiv.innerHTML = `
                <svg class="icon-sm" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
                </svg>
                <span>Lawliet (Legal Assistant)</span>
            `;
      bubbleDiv.appendChild(headerDiv);

      const contentDiv = document.createElement("div");
      contentDiv.innerHTML = content;
      bubbleDiv.appendChild(contentDiv);

      const disclaimerDiv = document.createElement("div");
      disclaimerDiv.className = "disclaimer";
      disclaimerDiv.innerHTML =
        "<em>This is informational only and not legal advice. Consult a qualified attorney for legal matters.</em>";
      bubbleDiv.appendChild(disclaimerDiv);
    } else {
      bubbleDiv.innerHTML = content;
    }

    messageDiv.appendChild(bubbleDiv);
    this.messagesArea.appendChild(messageDiv);
    this.scrollToBottom();
  }

  addSystemMessage(message) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message system";
    messageDiv.style.textAlign = "center";
    messageDiv.style.margin = "12px 0";

    const bubbleDiv = document.createElement("div");
    bubbleDiv.style.display = "inline-block";
    bubbleDiv.style.padding = "6px 12px";
    bubbleDiv.style.backgroundColor = "#f3f4f6";
    bubbleDiv.style.border = "1px solid #e5e7eb";
    bubbleDiv.style.borderRadius = "12px";
    bubbleDiv.style.fontSize = "10px";
    bubbleDiv.style.color = "#6b7280";
    bubbleDiv.textContent = message;

    messageDiv.appendChild(bubbleDiv);
    this.messagesArea.appendChild(messageDiv);
    this.scrollToBottom();
    this.hideWelcomeScreen();
  }

  async generateResponse(message, doc_name, educationMode) {
    try {
      const response = await fetch("http://localhost:5000/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, doc_name, educationMode }),
      });

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.error("Could not parse error response as JSON:", e);
        }
        return `Error ${response.status}: ${
          errorData.error || "Upload failed."
        }`;
      }

      const data = await response.json();
      return data.summary;
    } catch (error) {
      console.error("Upload error:", error);
      return "An error occurred.";
    }
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.sendBtn.disabled = loading;

    if (loading) {
      this.showLoadingMessage();
    } else {
      this.hideLoadingMessage();
    }
  }

  showLoadingMessage() {
    const loadingDiv = document.createElement("div");
    loadingDiv.id = "loadingMessage";
    loadingDiv.className = "loading-message";

    if(!this.educationMode){
          loadingDiv.innerHTML = `
            <div class="loading-bubble">
                <div class="loading-content">
                    <div class="spinner"></div>
                    Analyzing document...
                </div>
            </div>
        `;
    }else{
          loadingDiv.innerHTML = `
            <div class="loading-bubble">
                <div class="loading-content">
                    <div class="spinner"></div>
                    Analyzing document and thinking longer about what to teach...
                </div>
            </div>
        `;
    }
    this.messagesArea.appendChild(loadingDiv);
    this.scrollToBottom();
  }

  hideLoadingMessage() {
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) {
      loadingMessage.remove();
    }
  }

  hideWelcomeScreen() {
    this.welcomeScreen.classList.add("hidden");
  }

  showWelcomeScreen() {
    this.welcomeScreen.classList.remove("hidden");
    // Clear previous messages from the chat area
    const allMessages = this.messagesArea.querySelectorAll(".message");
    allMessages.forEach((msg) => msg.remove());

    this.messages = [];
    this.saveMessagesToStorage(); // optional: clear from storage too
  }

  scrollToBottom() {
    this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
  }

  // Storage methods
  async saveMessagesToStorage() {
    await window.chrome.storage.local.set({
      messages: this.messages.slice(-50), // Keep last 50 messages
    });
  }

  async saveDocumentToStorage() {
    if (this.currentDocument) {
      await window.chrome.storage.local.set({
        currentDocument: this.currentDocument,
      });
    }
  }

  async saveSettings() {
    await window.chrome.storage.local.set({
      educationMode: this.educationMode,
    });
  }

  async loadStoredData() {
    const data = await window.chrome.storage.local.get([
      "messages",
      "currentDocument",
      "educationMode",
    ]);

    if (data.messages) {
      this.messages = data.messages;
      this.restoreMessages();
    }

    if (data.currentDocument) {
      this.currentDocument = data.currentDocument;
      this.restoreDocument();
    }

    if (data.educationMode) {
      this.educationMode = data.educationMode;
      if (this.educationMode) {
        this.toggleEducationMode();
      }
    }
  }

  restoreMessages() {
    this.messages.forEach((msg) => {
      if (msg.role !== "system") {
        this.addMessage(msg.role, msg.content);
      }
    });
    if (this.messages.length > 0) {
      this.hideWelcomeScreen();
    }
  }

  // restoreDocument() {
  //   if (this.currentDocument) {
  //     if (this.currentDocument.type === "upload") {
  //       this.documentName.value = this.currentDocument.name;
  //       this.documentBadge.classList.remove("hidden");

  //       // Restore upload status
  //       const documentStatus = document.getElementById("documentStatus");
  //       const statusText = document.getElementById("statusText");
  //       const fileName = document.getElementById("fileName");

  //       documentStatus.classList.remove("hidden");
  //       statusText.textContent = "Document loaded from previous session";
  //       fileName.textContent = `${
  //         this.currentDocument.name
  //       } (${this.formatFileSize(this.currentDocument.size)})`;
  //     }
  //   }
  // }
}

// Initialize the extension when the popup loads
document.addEventListener("DOMContentLoaded", () => {
  new LegalAssistantExtension();
});

//testing for firebase
document.getElementById("signin-btn").addEventListener("click", () => {
  // Request an OAuth token interactively
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    // Use the token to fetch user info from Google
    fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => response.json())
      .then((user) => {
        console.log("User Info:", user);

        // Send user email to Flask backend
        fetch("http://localhost:5000/save-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: user.email, name: user.name }),
        })
          .then((response) => response.json())
          .then((data) => {
            console.log("Backend response:", data);
          })
          .catch((error) => {
            console.error("Error sending to backend:", error);
          });

        // Display user info in your popup
        document.getElementById("userinfo").innerHTML = `
          <div><strong>${user.name}</strong></div>
          <p>${user.email}</p>
          <img src="${user.picture}" width="50" />
        `;

        document.getElementById("signin-btn").style.display = "none";


        //FILE DROPDOWN SHIT
        loadFileList();
        document.getElementById("fileDropdown").style.display = "block";


      })
      .catch((error) => {
        console.error("Failed to fetch user info:", error);
      });
  });
});





function loadFileList() {
  fetch("http://localhost:5000/file-list")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch file list");
      return response.json();
    })
    .then((files) => {
      const dropdown = document.getElementById("fileDropdown");
      dropdown.innerHTML = '<option value="">Select a file...</option>';
      files.forEach((file) => {
        const option = document.createElement("option");
        option.value = file;
        option.textContent = file;
        dropdown.appendChild(option);
      });
    })
    .catch((err) => {
      console.error("Error fetching file list:", err);
    });
}
