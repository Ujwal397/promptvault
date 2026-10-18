/**
 * Given names that compromise's built-in lexicon misses. Its list is mostly Anglo, so names such as "Priya" were
 * tagged as plain nouns and never reached people(). These are common given names from South Asian, East Asian,
 * Southeast Asian, African, Arabic, Persian, Turkish, Hispanic, Slavic and other European traditions.
 * Names that are also everyday English words (e.g. "Hope", "Will", "Sunny") are left out to limit false positives.
 * Lower case; tagged FirstName. A lone name still scores as uncertain (advisory) unless corroborated.
 */
export const EXTRA_GIVEN_NAMES: readonly string[] = [
  // South Asian
  'aarav', 'aditi', 'aditya', 'akash', 'amit', 'amitabh', 'ananya', 'anika', 'anil', 'anjali', 'ankit', 'anushka',
  'arjun', 'arnav', 'aryan', 'ashok', 'deepak', 'deepika', 'devika', 'dhruv', 'divya', 'gaurav', 'harsh', 'ishaan',
  'ishita', 'kabir', 'kavya', 'krishna', 'lakshmi', 'mahesh', 'manish', 'meera', 'neha', 'nikhil', 'nisha', 'pooja',
  'pradeep', 'pranav', 'priya', 'priyanka', 'rahul', 'rajesh', 'rajiv', 'rakesh', 'ramesh', 'ravi', 'rohan',
  'rohit', 'sachin', 'sanjay', 'sanya', 'saanvi', 'shreya', 'siddharth', 'sneha', 'sunil', 'suresh', 'swati',
  'tanvi', 'tanya', 'ujwal', 'varun', 'vihaan', 'vijay', 'vikram', 'vivek', 'yash', 'zara', 'imran', 'farhan',
  'ayesha', 'fatima', 'bilal', 'hamza', 'usman', 'zainab', 'tahmina', 'nusrat', 'rizwan', 'kamal', 'tharindu',
  'nimal', 'dilshan', 'chathura',
  // East Asian
  'wei', 'jing', 'xiao', 'ming', 'ling', 'jian', 'liang',
  'haruto', 'yuki', 'hiroshi', 'kenji', 'takeshi', 'sakura', 'yui', 'haruka', 'riku', 'sota', 'aiko', 'naoko',
  'minjun', 'seojun', 'jiwoo', 'jisoo', 'minji', 'seoyeon', 'hyun', 'jiho', 'yuna',
  // Southeast Asian
  'thanh', 'linh', 'minh', 'tuan', 'huong', 'somchai', 'siriporn', 'putri', 'agus', 'budi',
  'dewi', 'wayan', 'rizal', 'jose', 'maricel', 'rodel',
  // African
  'chidi', 'chinedu', 'chioma', 'emeka', 'ngozi', 'oluwaseun', 'seun', 'tunde', 'adebayo', 'folake',
  'kemi', 'yetunde', 'kwame', 'kofi', 'akosua', 'abena', 'kwabena', 'thabo', 'sipho', 'lerato', 'nomvula',
  'zanele', 'themba', 'amara', 'nia', 'wanjiru', 'kamau', 'otieno', 'achieng', 'jabari', 'tendai', 'tatenda',
  'chipo', 'abdi', 'hodan', 'tesfaye', 'meron', 'selam', 'yonas',
  // Arabic, Persian, Turkish
  'ahmed', 'ahmad', 'mohammed', 'muhammad', 'mohamed', 'omar', 'ali', 'hassan', 'hussein', 'khalid', 'youssef',
  'yusuf', 'ibrahim', 'mustafa', 'tariq', 'karim', 'samir', 'nadia', 'layla', 'leila', 'mariam', 'noor', 'huda',
  'amira', 'yasmin', 'rania', 'salma', 'dalia', 'reza', 'dariush', 'farid', 'navid', 'shirin', 'parisa', 'maryam',
  'zahra', 'arash', 'mehmet', 'emre', 'burak', 'elif', 'zeynep', 'ayse', 'fatma', 'murat', 'deniz',
  // Hispanic, Portuguese
  'alejandro', 'alejandra', 'andres', 'camila', 'carlos', 'catalina', 'diego', 'esteban', 'fernando', 'gabriela',
  'guillermo', 'javier', 'jimena', 'joaquin', 'juan', 'lucia', 'luis', 'mateo', 'miguel', 'paola', 'pablo',
  'rafael', 'santiago', 'sofia', 'valentina', 'ximena', 'joao', 'thiago', 'rodrigo', 'beatriz', 'mariana',
  'goncalo', 'inês',
  // Slavic, Baltic, Central and Eastern European
  'aleksandr', 'aleksei', 'anastasia', 'dmitri', 'dmitry', 'ekaterina', 'irina', 'ivan', 'katarzyna', 'krzysztof',
  'magdalena', 'mikhail', 'natalia', 'nikolai', 'olga', 'pavel', 'piotr', 'sergei', 'svetlana', 'tatiana',
  'vladimir', 'yulia', 'zofia', 'tomasz', 'agnieszka', 'jakub', 'lukas', 'tereza', 'petra', 'jiri', 'andrej',
  'dragan', 'jelena', 'nemanja', 'bogdan', 'oksana', 'taras', 'andriy', 'mykola', 'ieva', 'janis',
  // Western and Northern European
  'anneke', 'bram', 'daan', 'sanne', 'lotte', 'jens', 'lars', 'sven', 'astrid', 'ingrid', 'sigrid', 'bjorn',
  'freya', 'mikkel', 'magnus', 'elin', 'aino', 'eero', 'jussi', 'matthias', 'jurgen', 'katrin', 'stefanie',
  'wolfgang', 'florian', 'mathieu', 'amelie', 'antoine', 'camille', 'clement', 'manon', 'theo', 'giulia',
  'giuseppe', 'lorenzo', 'matteo', 'chiara', 'francesca', 'alessandro', 'niamh', 'siobhan', 'saoirse', 'eoin',
  'aoife', 'cian', 'ciaran', 'oisin',
]
