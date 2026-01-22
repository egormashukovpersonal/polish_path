require "json"
require "csv"
require "httparty"
require "dotenv/load"
require "set"

API_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4.1"

SOURCE_DATA_FILE = "data/subtlex-pl.csv"
DEST_DATA_FILE   = "data/result.json"

def generate_for_chatgpt(words)
  prompt = <<~PROMPT
    Я учу польский язык.

    Даю тебе список слов, а ты мне в ответ JSON.
    Формат ответа: Верни ТОЛЬКО JSON-массив объектов со следующими ключами:

    - polish_word - String
    - russian_translation - String
    - russian_description - 1-2 предложения описание слова по русски
    - polish_description - 1-2 предложения описание слова по польски
    - usage_example - String - 1 предложение по польски с использованием слова

    Правила:
    - Никакого текста вне JSON
    - Без Markdown
    - Без вступлений и пояснений
    - Используй ТОЛЬКО слова из предоставленного списка.
    - НЕ добавляй новые слова.
    - НЕ заменяй слова на другие.

    Вот сами слова:
    #{words.join(", ")}
  PROMPT

  response = HTTParty.post(
    API_URL,
    headers: {
      "Authorization" => "Bearer #{ENV['OPENAI_API_KEY']}",
      "Content-Type"  => "application/json"
    },
    body: {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    }.to_json
  )

  content = response.dig("choices", 0, "message", "content")
  JSON.parse(content)
end

words = []
CSV.foreach(SOURCE_DATA_FILE, headers: true, col_sep: "\t") do |row|
  words << row["spelling"]
  break if words.size >= 20_000
end

puts "Загружено слов: #{words.size}"

result_data =
  if File.exist?(DEST_DATA_FILE)
    JSON.parse(File.read(DEST_DATA_FILE))
  else
    []
  end

CHUNK_SIZE = 20
MAX_RETRIES = 5
RETRY_SLEEP = 5 # секунд

processed_chunks = (result_data.size.to_f / CHUNK_SIZE).floor

words.each_slice(CHUNK_SIZE).with_index do |chunk, index|
  next if index < processed_chunks

  retries = 0

  begin
    puts "→ Step #{index + 1} | total words: #{result_data.size}"

    generated = generate_for_chatgpt(chunk)

    # страховка от дублей
    existing = result_data.map { |w| w["polish_word"].downcase }.to_set
    generated.reject! { |w| existing.include?(w["polish_word"].downcase) }

    result_data.concat(generated)

    File.write(
      DEST_DATA_FILE,
      JSON.pretty_generate(result_data, ensure_ascii: false)
    )

    sleep 1.5

  rescue Net::ReadTimeout, Timeout::Error, Errno::ECONNRESET => e
    retries += 1
    puts "⏳ Timeout в чанке #{index + 1}, попытка #{retries}/#{MAX_RETRIES}"

    if retries <= MAX_RETRIES
      sleep RETRY_SLEEP * retries # backoff
      retry
    else
      puts "❌ Превышено число повторов в чанке #{index + 1}"
      break
    end

  rescue JSON::ParserError => e
    puts "❌ Некорректный JSON в чанке #{index + 1}: #{e.message}"
    break

  rescue => e
    puts "❌ Фатальная ошибка в чанке #{index + 1}: #{e.class} — #{e.message}"
    break
  end
end


puts "✅ Готово. Итоговых слов: #{result_data.size}"
