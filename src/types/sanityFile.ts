export type SanityFile = {
  _id: string; // Уникальный идентификатор документа
  _type: "docFile"; // Тип документа в Sanity
  title: string; // Заголовок файла
  slug: {
    current: string; // Слаг файла, используется в URL
  };
  file: {
    asset: {
      url: string; // Ссылка на файл
    };
  };
};
