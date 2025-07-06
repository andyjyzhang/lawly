// Content script to detect legal documents on web pages
;(() => {
  // Declare chrome variable
  const chrome = window.chrome

  // Legal document detection
  function detectLegalDocument() {
    const legalKeywords = [
      "terms of service",
      "privacy policy",
      "user agreement",
      "license agreement",
      "employment contract",
      "lease agreement",
      "rental agreement",
      "mortgage",
      "loan agreement",
      "non-disclosure agreement",
      "nda",
      "terms and conditions",
      "end user license agreement",
      "eula",
      "service agreement",
      "subscription agreement",
      "copyright notice",
      "trademark",
      "legal notice",
      "disclaimer",
    ]

    const pageText = document.body.innerText.toLowerCase()
    const title = document.title.toLowerCase()
    const url = window.location.href.toLowerCase()

    // Check for legal keywords in content
    const foundKeywords = legalKeywords.filter(
      (keyword) => pageText.includes(keyword) || title.includes(keyword) || url.includes(keyword.replace(/\s+/g, "")),
    )

    // Check for legal document structure
    const hasLegalStructure = checkLegalStructure()

    if (foundKeywords.length > 2 || hasLegalStructure) {
      return {
        detected: true,
        confidence: foundKeywords.length > 5 ? "high" : "medium",
        keywords: foundKeywords,
        title: document.title,
        url: window.location.href,
        content: extractRelevantContent(),
      }
    }

    return { detected: false }
  }

  function checkLegalStructure() {
    // Look for numbered sections, legal formatting
    const sections = document.querySelectorAll("h1, h2, h3, h4, h5, h6")
    let legalSectionCount = 0

    sections.forEach((section) => {
      const text = section.textContent.toLowerCase()
      if (
        text.match(/^\d+\./) ||
        text.includes("section") ||
        text.includes("article") ||
        text.includes("clause") ||
        text.includes("paragraph")
      ) {
        legalSectionCount++
      }
    })

    return legalSectionCount > 3
  }

  function extractRelevantContent() {
    // Extract first 2000 characters of meaningful content
    const content = document.body.innerText
    return content.substring(0, 2000)
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "detectDocument") {
      const result = detectLegalDocument()
      sendResponse(result)
    }

    if (request.action === "getPageContent") {
      sendResponse({
        title: document.title,
        url: window.location.href,
        content: extractRelevantContent(),
      })
    }
  })

  // Auto-detect on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => {
        const detection = detectLegalDocument()
        if (detection.detected) {
          chrome.runtime.sendMessage({
            action: "documentDetected",
            data: detection,
          })
        }
      }, 1000)
    })
  } else {
    setTimeout(() => {
      const detection = detectLegalDocument()
      if (detection.detected) {
        chrome.runtime.sendMessage({
          action: "documentDetected",
          data: detection,
        })
      }
    }, 1000)
  }
})()
