require "json"

INPUT_FILE  = "data/result.json"
OUTPUT_FILE = "data/result_shuffled.json"

data = JSON.parse(File.read(INPUT_FILE))

shuffled = data.shuffle

File.write(
  OUTPUT_FILE,
  JSON.pretty_generate(shuffled, indent: "  ")
)
