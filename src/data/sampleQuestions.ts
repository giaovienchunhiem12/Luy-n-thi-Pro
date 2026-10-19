export interface QuestionItem {
  questionText: string;
  options: string[];
  correctAnswer: string;
  section: string;
  hasImage?: boolean;
  imageUrl?: string;
  imageDescription?: string;
  solution?: string;
}

export interface SectionPointsConfig {
  p1: number;
  p2: {
    opt1: number;
    opt2: number;
    opt3: number;
    opt4: number;
  };
  p3: number;
}

export const DEFAULT_SECTION_POINTS: SectionPointsConfig = {
  p1: 0.25,
  p2: {
    opt1: 0.1,
    opt2: 0.25,
    opt3: 0.5,
    opt4: 1.0
  },
  p3: 0.25
};

export const DEFAULT_SAMPLE_QUESTIONS: QuestionItem[] = [
  // ========================================================
  // PHẦN I. Câu hỏi trắc nghiệm nhiều phương án lựa chọn (18 câu)
  // ========================================================
  {
    questionText: 'Theo mô hình động học phân tử chất khí, lực tương tác giữa các phân tử khí khi ở xa nhau là:',
    options: [
      'Lực hút.',
      'Lực đẩy.',
      'Không đáng kể.',
      'Vừa hút vừa đẩy bằng nhau.'
    ],
    correctAnswer: 'C',
    section: 'Phần I - Câu 1',
    hasImage: false,
    solution: 'Khi các phân tử khí ở xa nhau, khoảng cách giữa chúng rất lớn so với kích thước phân tử nên lực tương tác giữa chúng là không đáng kể (coi như bằng không).'
  },
  {
    questionText: 'Đặc điểm nào sau đây là của chất rắn vô định hình?',
    options: [
      'Có cấu trúc tinh thể xác định.',
      'Có nhiệt độ nóng chảy xác định.',
      'Có tính dị hướng.',
      'Không có nhiệt độ nóng chảy xác định.'
    ],
    correctAnswer: 'D',
    section: 'Phần I - Câu 2',
    hasImage: false,
    solution: 'Chất rắn vô định hình không có cấu trúc tinh thể, do đó có tính đẳng hướng và không có nhiệt độ nóng chảy xác định (nó mềm dần khi nhiệt độ tăng).'
  },
  {
    questionText: 'Hiện tượng chất lỏng chuyển thành chất khí xảy ra ở cả mặt thoáng và trong lòng chất lỏng được gọi là:',
    options: [
      'Sự sôi.',
      'Sự bay hơi.',
      'Sự ngưng tụ.',
      'Sự thăng hoa.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 3',
    hasImage: false,
    solution: 'Sự sôi là quá trình chuyển thể từ lỏng sang khí xảy ra đồng thời ở cả mặt thoáng và trong lòng chất lỏng ở một nhiệt độ sôi xác định.'
  },
  {
    questionText: 'Nội năng của một lượng khí lí tưởng đơn nguyên tử chỉ phụ thuộc vào:',
    options: [
      'Thể tích của khối khí.',
      'Áp suất của khối khí.',
      'Nhiệt độ tuyệt đối của khối khí.',
      'Khối lượng riêng của khối khí.'
    ],
    correctAnswer: 'C',
    section: 'Phần I - Câu 4',
    hasImage: false,
    solution: 'Đối với khí lí tưởng, các phân tử được coi là chất điểm và bỏ qua thế năng tương tác phân tử, do đó nội năng chỉ bao gồm tổng động năng nhiệt của các phân tử và chỉ phụ thuộc vào nhiệt độ tuyệt đối T.'
  },
  {
    questionText: 'Theo quy ước dấu trong biểu thức định luật I nhiệt động lực học ΔU = A + Q, hệ nhận nhiệt lượng và sinh công lên môi trường ngoài thì:',
    options: [
      'Q > 0 và A > 0.',
      'Q > 0 và A < 0.',
      'Q < 0 và A > 0.',
      'Q < 0 và A < 0.'
    ],
    correctAnswer: 'B',
    section: 'Phần I - Câu 5',
    hasImage: false,
    solution: 'Hệ nhận nhiệt lượng: Q > 0. Hệ sinh công (thực hiện công lên môi trường ngoài): A < 0.'
  },
  {
    questionText: 'Công thức liên hệ giữa thang nhiệt độ Celsius (t °C) và thang nhiệt độ Kelvin (T K) là:',
    options: [
      'T = t + 273,15.',
      'T = t - 273,15.',
      'T = 1,8t + 32.',
      'T = (t - 32) / 1,8.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 6',
    hasImage: false,
    solution: 'Mối liên hệ giữa nhiệt độ trong thang Kelvin và thang Celsius là: T(K) = t(°C) + 273,15.'
  },
  {
    questionText: 'Nhiệt độ không tuyệt đối (0 K) là nhiệt độ mà tại đó:',
    options: [
      'Nước đá bắt đầu nóng chảy ở áp suất tiêu chuẩn.',
      'Mọi chất khí đều hóa lỏng hoàn toàn.',
      'Động năng chuyển động nhiệt của các phân tử triệt tiêu và áp suất của chất khí bằng 0.',
      'Nước sôi ở áp suất khí quyển 1 atm.'
    ],
    correctAnswer: 'C',
    section: 'Phần I - Câu 7',
    hasImage: false,
    solution: '0 Kelvin là độ không tuyệt đối, tại đó động năng chuyển động nhiệt hỗn loạn của các hạt triệt tiêu và áp suất của chất khí giảm về 0.'
  },
  {
    questionText: 'Đơn vị đo của nhiệt dung riêng trong hệ đơn vị quốc tế SI là:',
    options: [
      'J/kg.',
      'J/(kg.K).',
      'J.K/kg.',
      'cal/g.'
    ],
    correctAnswer: 'B',
    section: 'Phần I - Câu 8',
    hasImage: false,
    solution: 'Nhiệt dung riêng c = Q / (m.ΔT) nên có đơn vị là J/(kg.K) hoặc J/(kg.°C).'
  },
  {
    questionText: 'Nhiệt nóng chảy riêng λ của một chất rắn kết tinh là nhiệt lượng cần cung cấp để:',
    options: [
      'Làm nóng 1 kg chất rắn lên thêm 1 °C.',
      'Làm 1 kg chất rắn nóng chảy hoàn toàn ở nhiệt độ nóng chảy.',
      'Hóa hơi hoàn toàn 1 kg chất lỏng ở nhiệt độ sôi.',
      'Nâng nhiệt độ nóng chảy của chất rắn lên 1 K.'
    ],
    correctAnswer: 'B',
    section: 'Phần I - Câu 9',
    hasImage: false,
    solution: 'Nhiệt nóng chảy riêng λ là nhiệt lượng cần truyền cho 1 kg chất rắn để nó chuyển hoàn toàn từ thể rắn sang thể lỏng ở nhiệt độ nóng chảy: Q = m.λ.'
  },
  {
    questionText: 'Nhiệt lượng cần cung cấp để làm nóng chảy hoàn toàn 2 kg đồng ở nhiệt độ nóng chảy (biết nhiệt nóng chảy riêng của đồng là 1,8.10⁵ J/kg) là:',
    options: [
      '3,6.10⁵ J.',
      '0,9.10⁵ J.',
      '1,8.10⁵ J.',
      '7,2.10⁵ J.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 10',
    hasImage: false,
    solution: 'Q = m.λ = 2 * 1,8.10⁵ = 3,6.10⁵ J.'
  },
  {
    questionText: 'Nhiệt hóa hơi riêng L của một chất lỏng phụ thuộc vào:',
    options: [
      'Bản chất của chất lỏng và nhiệt độ sôi.',
      'Khối lượng của khối chất lỏng.',
      'Diện tích mặt thoáng của chất lỏng.',
      'Thể tích ban đầu của khối chất lỏng.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 11',
    hasImage: false,
    solution: 'Nhiệt hóa hơi riêng L phụ thuộc vào bản chất của chất lỏng và nhiệt độ mà ở đó chất lỏng hóa hơi.'
  },
  {
    questionText: 'Một chất khí trong xi lanh nhận công 80 J do pít-tông nén lại, đồng thời truyền ra môi trường nhiệt lượng 30 J. Độ biến thiên nội năng của khối khí là:',
    options: [
      '+50 J.',
      '-50 J.',
      '+110 J.',
      '-110 J.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 12',
    hasImage: false,
    solution: 'Khí nhận công nên A = +80 J; khí truyền nhiệt nên Q = -30 J. Độ biến thiên nội năng: ΔU = A + Q = 80 - 30 = +50 J.'
  },
  {
    questionText: 'Nhiệt kế y tế thủy ngân hoạt động dựa trên hiện tượng vật lí nào sau đây?',
    options: [
      'Sự dãn nở vì nhiệt của chất lỏng.',
      'Hiệu ứng nhiệt điện giữa hai kim loại khác nhau.',
      'Sự thay đổi điện trở theo nhiệt độ.',
      'Sự bức xạ hồng ngoại của cơ thể.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 13',
    hasImage: false,
    solution: 'Nhiệt kế y tế thủy ngân truyền thống hoạt động dựa trên sự nở vì nhiệt của chất lỏng trong ống quản.'
  },
  {
    questionText: 'Trong thí nghiệm thực hành đo nhiệt dung riêng của nước, bộ dụng cụ nào sau đây dùng để đo nhiệt lượng do dây nung tỏa ra?',
    options: [
      'Oát kế (hoặc vôn kế kết hợp ampe kế) và đồng hồ bấm giây.',
      'Thước kẻ và cân điện tử.',
      'Nhiệt kế chất lỏng và ống đong.',
      'Lực kế và nhiệt kế điện tử.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 14',
    hasImage: false,
    solution: 'Nhiệt lượng do dây điện trở tỏa ra được tính theo công thức Q = P.t = U.I.t, nên cần dùng oát kế (hoặc vôn kế và ampe kế) kết hợp đồng hồ bấm giây để đo thời gian.'
  },
  {
    questionText: 'Đun nóng 0,5 kg nước từ 20 °C lên 60 °C. Biết nhiệt dung riêng của nước là 4180 J/(kg.K). Nhiệt lượng nước đã hấp thụ là:',
    options: [
      '83 600 J.',
      '41 800 J.',
      '167 200 J.',
      '20 900 J.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 15',
    hasImage: false,
    solution: 'Q = m.c.Δt = 0,5 * 4180 * (60 - 20) = 0,5 * 4180 * 40 = 83 600 J.'
  },
  {
    questionText: 'Nhiệt độ nóng chảy của nước đá nguyên chất trong thang nhiệt độ Kelvin là:',
    options: [
      '273,15 K.',
      '373,15 K.',
      '0 K.',
      '32 K.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 16',
    hasImage: false,
    solution: 'Nước đá nóng chảy ở 0 °C tương ứng với T = 0 + 273,15 = 273,15 K.'
  },
  {
    questionText: 'Khi dùng tay cọ xát hai lòng bàn tay vào nhau, ta thấy hai bàn tay ấm nóng lên. Quá trình này thể hiện:',
    options: [
      'Quá trình thực hiện công làm tăng nội năng.',
      'Quá trình truyền nhiệt làm tăng nội năng.',
      'Cả thực hiện công và truyền nhiệt đồng thời từ ngoài vào.',
      'Nội năng của hai bàn tay không đổi.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 17',
    hasImage: false,
    solution: 'Cơ năng khi hai bàn tay ma sát đã chuyển hóa thành nội năng của hai bàn tay qua phương thức thực hiện công.'
  },
  {
    questionText: 'Nhiệt độ sôi của nước tinh khiết ở áp suất khí quyển tiêu chuẩn 1 atm trong thang nhiệt độ Fahrenheit (°F) là:',
    options: [
      '212 °F.',
      '100 °F.',
      '32 °F.',
      '180 °F.'
    ],
    correctAnswer: 'A',
    section: 'Phần I - Câu 18',
    hasImage: false,
    solution: 't(°F) = 1,8 * t(°C) + 32 = 1,8 * 100 + 32 = 212 °F.'
  },

  // ========================================================
  // PHẦN II. Câu trắc nghiệm đúng sai (4 câu)
  // ========================================================
  {
    questionText: 'Khi nghiên cứu về cấu trúc của chất, mô hình động học phân tử và các quá trình chuyển thể của vật chất:',
    options: [
      'a) Các phân tử cấu tạo nên chất luôn chuyển động hỗn loạn không ngừng về mọi phía.',
      'b) Ở thể rắn, các phân tử dao động quanh các vị trí cân bằng cố định trong không gian.',
      'c) Quá trình một chất chuyển trực tiếp từ thể rắn sang thể khí gọi là sự ngưng kết.',
      'd) Trong suốt quá trình một khối chì đang nóng chảy ở nhiệt độ xác định, nhiệt độ của khối chì tiếp tục tăng dần do được cung cấp nhiệt lượng liên tục.'
    ],
    correctAnswer: 'a) Đúng - b) Đúng - c) Sai - d) Sai',
    section: 'Phần II - Câu 1',
    hasImage: false,
    solution: 'a) Đúng. Theo mô hình động học phân tử, các phân tử chuyển động hỗn loạn không ngừng, chuyển động càng nhanh khi nhiệt độ càng cao.\nb) Đúng. Ở thể rắn, lực liên kết phân tử rất mạnh, các phân tử chỉ dao động quanh vị trí cân bằng xác định.\nc) Sai. Quá trình chất rắn chuyển trực tiếp sang thể khí gọi là sự thăng hoa (sự ngưng kết là quá trình chuyển từ thể khí sang thể rắn).\nd) Sai. Trong suốt quá trình nóng chảy của chất rắn kết tinh, nhiệt độ được giữ không đổi cho đến khi toàn bộ chất rắn nóng chảy hoàn toàn.'
  },
  {
    questionText: 'Một lượng khí lí tưởng chứa trong một xi lanh có pít-tông kín di chuyển được. Người ta cung cấp cho khối khí một nhiệt lượng 250 J, đồng thời chất khí dãn nở đẩy pít-tông chuyển động và thực hiện một công 180 J lên môi trường ngoài:',
    options: [
      'a) Theo định luật I nhiệt động lực học, độ biến thiên nội năng của khối khí được xác định bằng công thức ΔU = A + Q.',
      'b) Khối khí nhận nhiệt lượng từ bên ngoài nên giá trị nhiệt lượng mang dấu dương: Q = +250 J.',
      'c) Khối khí thực hiện công đẩy pít-tông lên môi trường ngoài nên công chất khí nhận được là A = +180 J.',
      'd) Độ biến thiên nội năng của khối khí trong quá trình dãn nở này là ΔU = 70 J.'
    ],
    correctAnswer: 'a) Đúng - b) Đúng - c) Sai - d) Đúng',
    section: 'Phần II - Câu 2',
    hasImage: false,
    solution: 'a) Đúng. Biểu thức của định luật I nhiệt động lực học là ΔU = A + Q.\nb) Đúng. Hệ nhận nhiệt lượng thì Q > 0 => Q = +250 J.\nc) Sai. Khối khí thực hiện công (sinh công) lên môi trường thì công hệ nhận được mang dấu âm: A = -180 J.\nd) Đúng. ΔU = A + Q = -180 + 250 = +70 J > 0 (nội năng của khối khí tăng thêm 70 J).'
  },
  {
    questionText: 'Trong giờ thực hành Vật lí 12, một nhóm học sinh tiến hành thí nghiệm đo nhiệt dung riêng của nước bằng nhiệt lượng kế. Dùng nguồn điện cấp dòng điện chạy qua một dây nung điện trở có công suất không đổi P = 15 W đun m = 150 g nước đựng trong bình nhiệt lượng kế. Bỏ qua nhiệt dung của bình và sự thất thoát nhiệt ra môi trường. Sau thời gian τ = 400 s, nhiệt kế chỉ nhiệt độ nước tăng thêm Δt = 9,5 °C:',
    options: [
      'a) Nhiệt lượng tỏa ra từ dây nung trong thời gian 400 s là Q = 6 000 J.',
      'b) Khối lượng nước sử dụng trong thí nghiệm đổi ra đơn vị chuẩn SI là m = 1,5 kg.',
      'c) Giá trị nhiệt dung riêng của nước xác định được từ kết quả thí nghiệm xấp xỉ bằng 4 210 J/(kg.K).',
      'd) Nếu xét đến sự thất thoát nhiệt ra môi trường bên ngoài, nhiệt dung riêng thực tế đo được theo phương pháp này sẽ nhỏ hơn nhiệt dung riêng chuẩn của nước.'
    ],
    correctAnswer: 'a) Đúng - b) Sai - c) Đúng - d) Sai',
    section: 'Phần II - Câu 3',
    hasImage: false,
    solution: 'a) Đúng. Q_tỏa = P * τ = 15 W * 400 s = 6 000 J.\nb) Sai. Khối lượng nước là m = 150 g = 0,15 kg (không phải 1,5 kg).\nc) Đúng. c = Q / (m * Δt) = 6 000 / (0,15 * 9,5) ≈ 4 210,5 J/(kg.K).\nd) Sai. Vì có nhiệt lượng tỏa ra môi trường nên Q_dây tỏa > Q_nước thu. Khi tính c = Q_dây tỏa / (m * Δt) thì giá trị c đo được sẽ lớn hơn giá trị thực tế của nước.'
  },
  {
    questionText: 'Một nhóm nghiên cứu tiến hành cấp nhiệt đều đặn cho một khối nước đá có khối lượng m = 0,5 kg đang ở nhiệt độ ban đầu -10 °C để đưa lên 100 °C rồi làm hóa hơi hoàn toàn. Cho biết: nhiệt dung riêng của nước đá c₁ = 2090 J/(kg.K), nhiệt dung riêng của nước c₂ = 4180 J/(kg.K), nhiệt nóng chảy riêng của nước đá λ = 3,34.10⁵ J/kg, nhiệt hóa hơi riêng của nước L = 2,26.10⁶ J/kg:',
    options: [
      'a) Nhiệt lượng cần thiết để nâng nhiệt độ của khối nước đá từ -10 °C lên đến nhiệt độ nóng chảy 0 °C là 10 450 J.',
      'b) Nhiệt lượng cần cung cấp để làm nóng chảy hoàn toàn 0,5 kg nước đá ở 0 °C thành nước ở 0 °C là 1,67.10⁵ J.',
      'c) Nhiệt lượng cần cung cấp để nâng nhiệt độ của 0,5 kg nước từ 0 °C lên 100 °C là 418 000 J.',
      'd) Nhiệt lượng cần thiết để 0,5 kg nước ở 100 °C hóa hơi hoàn toàn ở 100 °C là 1,13.10⁶ J.'
    ],
    correctAnswer: 'a) Đúng - b) Đúng - c) Sai - d) Đúng',
    section: 'Phần II - Câu 4',
    hasImage: false,
    solution: 'a) Đúng. Q₁ = m * c₁ * Δt₁ = 0,5 * 2090 * (0 - (-10)) = 10 450 J.\nb) Đúng. Q₂ = m * λ = 0,5 * 3,34.10⁵ = 167 000 J = 1,67.10⁵ J.\nc) Sai. Q₃ = m * c₂ * Δt₂ = 0,5 * 4180 * (100 - 0) = 209 000 J (không phải 418 000 J).\nd) Đúng. Q₄ = m * L = 0,5 * 2,26.10⁶ = 1,13.10⁶ J = 1 130 000 J.'
  },

  // ========================================================
  // PHẦN III. Câu trắc nghiệm trả lời ngắn (6 câu)
  // ========================================================
  {
    questionText: 'Một mẫu chất khí đang ở nhiệt độ phòng 25 °C. Khi chuyển sang thang nhiệt độ tuyệt đối Kelvin, nhiệt độ của mẫu khí này bằng bao nhiêu K?',
    options: [],
    correctAnswer: '298',
    section: 'Phần III - Câu 1',
    hasImage: false,
    solution: 'Nhiệt độ tuyệt đối T(K) = t(°C) + 273,15 = 25 + 273,15 = 298,15 K ≈ 298 K.'
  },
  {
    questionText: 'Người ta truyền cho một lượng khí trong xi lanh một nhiệt lượng 120 J. Đồng thời khí nở ra sinh một công 70 J đẩy pít-tông lên. Độ biến thiên nội năng của khối khí bằng bao nhiêu Jun (J)?',
    options: [],
    correctAnswer: '50',
    section: 'Phần III - Câu 2',
    hasImage: false,
    solution: 'Theo định luật I nhiệt động lực học: ΔU = A + Q. Vì khí nhận nhiệt lượng nên Q = +120 J. Khí sinh công nên A = -70 J. Do đó: ΔU = 120 - 70 = 50 J.'
  },
  {
    questionText: 'Thả một thỏi nhôm có khối lượng 0,2 kg ở nhiệt độ 100 °C vào một nhiệt lượng kế chứa 0,4 kg nước ở nhiệt độ 20 °C. Bỏ qua nhiệt dung của bình nhiệt lượng kế và hao phí nhiệt ra môi trường. Biết nhiệt dung riêng của nhôm là 880 J/(kg.K), của nước là 4180 J/(kg.K). Nhiệt độ cân bằng nhiệt của hệ là bao nhiêu °C? (Làm tròn kết quả đến hàng phần mười).',
    options: [],
    correctAnswer: '27,6',
    section: 'Phần III - Câu 3',
    hasImage: false,
    solution: 'Phương trình cân bằng nhiệt: Q_tỏa = Q_thu <=> m_Al * c_Al * (t_Al - t) = m_H2O * c_H2O * (t - t_H2O) <=> 0,2 * 880 * (100 - t) = 0,4 * 4180 * (t - 20) <=> 176 * (100 - t) = 1672 * (t - 20) <=> 17600 - 176t = 1672t - 33440 <=> 1848t = 51040 => t ≈ 27,62 °C ≈ 27,6 °C.'
  },
  {
    questionText: 'Cần cung cấp một nhiệt lượng bằng bao nhiêu kilôjun (kJ) để làm nóng chảy hoàn toàn 1,5 kg nước đá ở nhiệt độ 0 °C? Biết nhiệt nóng chảy riêng của nước đá là 3,34.10⁵ J/kg. (Làm tròn kết quả đến hàng đơn vị).',
    options: [],
    correctAnswer: '501',
    section: 'Phần III - Câu 4',
    hasImage: false,
    solution: 'Nhiệt lượng cần cung cấp: Q = m * λ = 1,5 * 3,34.10⁵ J = 501 000 J = 501 kJ.'
  },
  {
    questionText: 'Dùng một ấm đun nước điện có hiệu suất 90% để đun sôi 0,5 kg nước từ nhiệt độ ban đầu 20 °C đến 100 °C, đồng thời làm hóa hơi 0,05 kg nước trong ấm. Biết thời gian đun là 8 phút, nhiệt dung riêng của nước là 4200 J/(kg.K), nhiệt hóa hơi riêng của nước là 2,26.10⁶ J/kg. Công suất tiêu thụ điện của ấm nước là bao nhiêu oát (W)? (Làm tròn kết quả đến hàng đơn vị).',
    options: [],
    correctAnswer: '826',
    section: 'Phần III - Câu 5',
    hasImage: false,
    solution: 'Nhiệt lượng có ích làm nóng nước và hóa hơi nước:\nQ_ích = m_n * c * (100 - 20) + m_hh * L = 0,5 * 4200 * 80 + 0,05 * 2,26.10⁶ = 168 000 + 113 000 = 281 000 J.\nNhiệt lượng toàn phần ấm điện tỏa ra: Q_tp = Q_ích / H = 281 000 / 0,90 ≈ 312 222,2 J.\nThời gian đun: t = 8 * 60 = 480 s.\nCông suất của ấm: P = Q_tp / t = 312 222,2 / 480 ≈ 825,9 W ≈ 826 W.'
  },
  {
    questionText: 'Khi 1 kg nước ở nhiệt độ 100 °C hóa hơi hoàn toàn thành hơi nước ở 100 °C dưới áp suất khí quyển tiêu chuẩn 1,013.10⁵ Pa, thể tích của khối hơi nước tạo thành là 1,673 m³ (bỏ qua thể tích của 1 kg nước ở thể lỏng). Biết nhiệt hóa hơi riêng của nước là 2,26.10⁶ J/kg. Tỉ lệ phần trăm (%) nhiệt lượng được sử dụng để làm tăng nội năng của hệ so với tổng nhiệt lượng cung cấp là bao nhiêu? (Làm tròn kết quả đến hàng phần mười).',
    options: [],
    correctAnswer: '92,5',
    section: 'Phần III - Câu 6',
    hasImage: false,
    solution: 'Tổng nhiệt lượng cung cấp để 1 kg nước hóa hơi: Q = m * L = 1 * 2,26.10⁶ = 2 260 000 J.\nCông mà khối nước thực hiện để dãn nở chống lại áp suất khí quyển ngoài: A\' = p * ΔV = 1,013.10⁵ * 1,673 ≈ 169 475 J.\nTheo định luật I nhiệt động lực học: Độ biến thiên nội năng là ΔU = Q - A\' = 2 260 000 - 169 475 = 2 090 525 J.\nTỉ lệ phần trăm nhiệt lượng chuyển thành nội năng:\n%ΔU = (ΔU / Q) * 100% = (2 090 525 / 2 260 000) * 100% ≈ 92,5%.'
  }
];
