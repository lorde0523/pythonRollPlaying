const form = document.querySelector("#generator-form");
const button = document.querySelector("#generate-button");
const statusBox = document.querySelector("#status");
const resultCard = document.querySelector("#result");
const resultSummary = document.querySelector("#result-summary");
const relatedFiles = document.querySelector("#related-files");
const downloadLink = document.querySelector("#download-link");

const fields = {
  frontendPath: document.querySelector("#frontend-path"),
  backendPath: document.querySelector("#backend-path"),
  screen: document.querySelector("#screen"),
};

for (const [name, field] of Object.entries(fields)) {
  field.value = localStorage.getItem(`testdoc.${name}`) || "";
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
  statusBox.hidden = false;
}

function setLoading(loading) {
  button.disabled = loading;
  button.querySelector("span").textContent = loading ? "관련 파일을 분석하는 중..." : "Excel 테스트 문서 생성";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultCard.hidden = true;
  setLoading(true);
  setStatus("선택 화면의 컴포넌트와 API 연결을 확인하고 있습니다.");

  const payload = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value.trim()]));
  for (const [name, value] of Object.entries(payload)) localStorage.setItem(`testdoc.${name}`, value);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "문서를 생성하지 못했습니다.");

    resultSummary.textContent = `${data.screen} · 관련 파일 ${data.relatedFiles.length}개 · API ${data.endpointCount}개 · 테스트 케이스 ${data.caseCount}건`;
    relatedFiles.textContent = data.relatedFiles.length ? `포함 파일: ${data.relatedFiles.join(", ")}` : "포함된 프론트 파일이 없습니다.";
    downloadLink.href = data.downloadUrl;
    resultCard.hidden = false;
    statusBox.hidden = true;
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    setStatus(error.message || "처리 중 오류가 발생했습니다.", true);
  } finally {
    setLoading(false);
  }
});
