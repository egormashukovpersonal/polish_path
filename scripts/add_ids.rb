require "json"

FILE = "data/result_shuffled.json"

data = JSON.parse(File.read(FILE))

data.each_with_index do |item, index|
  item["id"] = index + 1
end

File.write(
  FILE,
  JSON.pretty_generate(data, indent: "  ")
)
