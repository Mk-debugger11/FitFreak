require('dotenv').config();
const mongoose = require('mongoose');
const CompletedWorkout = require('./models/CompletedWorkout');
const TargetMuscle = require('./models/TargetMuscle');

const data = {
  "2026-05-06": {
    "Biceps": {
      "Dumbbell Bicep Curl": [
        "15kg/hand × 10",
        "15kg/hand × 11",
        "15kg/hand × 11"
      ],
      "Hammer Curl": [
        "15kg/hand × 10",
        "15kg/hand × 10",
        "15kg/hand × 10"
      ],
      "Barbell Curl": [
        "32.5kg × 10",
        "32.5kg × 10",
        "32.5kg × 8"
      ]
    }
  },

  "2026-05-07": {
    "Chest": {
      "Incline Dumbbell Press": [
        "15kg/hand × 10",
        "20kg/hand × 12",
        "22.5kg/hand × 12",
        "20kg/hand × 12"
      ],
      "Flat Dumbbell Press": [
        "20kg/hand × 12",
        "22.5kg/hand × 10",
        "22.5kg/hand × 9"
      ],
      "Incline Dumbbell Fly": [
        "12.5kg/hand × 12",
        "12.5kg/hand × 12"
      ],
      "Pec Dec Fly": [
        "45kg × 12"
      ]
    }
  },

  "2026-05-12": {
    "Chest": {
      "Incline Dumbbell Press": [
        "17.5kg/hand × 10",
        "20kg/hand × 10",
        "25kg/hand × 10",
        "25kg/hand × 10"
      ],
      "Flat Dumbbell Press": [
        "20kg/hand × 10",
        "25kg/hand × 9",
        "25kg/hand × 8"
      ],
      "Incline Dumbbell Fly": [
        "15kg/hand × 12",
        "15kg/hand × 10",
        "12.5kg/hand × 13"
      ],
      "Pec Dec Fly": [
        "45kg × 11",
        "40kg × 12"
      ]
    }
  },

  "2026-05-13": {
    "Biceps": {
      "Dumbbell Bicep Curl": [
        "15kg/hand × 10",
        "15kg/hand × 10",
        "15kg/hand × 10"
      ],
      "Hammer Curl": [
        "15kg/hand × 10",
        "15kg/hand × 10",
        "15kg/hand × 10"
      ],
      "Barbell Curl": [
        "32.5kg × 10",
        "32.5kg × 10",
        "32.5kg × 9"
      ]
    },
    "Forearms": {
      "Reverse Cable Curl": [
        "50kg × 15",
        "60kg × 15",
        "75kg × 12"
      ],
      "Wrist Curl": [
        "22.5kg × 15",
        "30kg × 15",
        "30kg × 14"
      ]
    }
  },

  "2026-05-14": {
    "Chest": {
      "Incline Dumbbell Press": [
        "15kg/hand × 10",
        "20kg/hand × 12",
        "25kg/hand × 10",
        "20kg/hand × 12"
      ],
      "Flat Dumbbell Press": [
        "20kg/hand × 12",
        "20kg/hand × 12",
        "20kg/hand × 15"
      ],
      "Incline Dumbbell Fly": [
        "12.5kg/hand × 13",
        "12.5kg/hand × 13"
      ],
      "Pec Dec Fly": [
        "45kg × 14",
        "55kg × 8",
        "45kg × 6",
        "40kg × 14"
      ]
    },
    "Triceps": {
      "Tricep Pushdown": [
        "45kg × 12",
        "45kg × 13",
        "45kg × 13"
      ],
      "Overhead Cable Extension": [
        "35kg × 12",
        "40kg × 8"
      ],
      "Overhead Dumbbell Extension": [
        "15kg × 12",
        "17.5kg × 10"
      ]
    }
  },

  "2026-05-15": {
    "Back": {
      "Lat Pulldown": [
        "45kg × 12",
        "50kg × 12",
        "60kg × 8",
        "45kg × 5",
        "50kg × 10"
      ],
      "T-Bar Row": [
        "35kg × 12",
        "45kg × 10",
        "45kg × 11"
      ],
      "Straight Arm Pulldown": [
        "30kg × 12",
        "37.5kg × 14",
        "45kg × 15",
        "45kg × 15"
      ],
      "Single Arm Dumbbell Row": [
        "25kg × 10",
        "30kg × 10"
      ]
    }
  },

  "2026-05-16": {
    "Biceps": {
      "Incline Dumbbell Curl": [
        "12.5kg/hand × 10",
        "15kg/hand × 8",
        "12.5kg/hand × 2",
        "12.5kg/hand × 10",
        "10kg/hand × 11"
      ],
      "Preacher Curl": [
        "27.5kg × 10",
        "32.5kg × 10",
        "32.5kg × 10"
      ],
      "Hammer Curl": [
        "12.5kg/hand × 10",
        "12.5kg/hand × 11",
        "12.5kg/hand × 10"
      ]
    },
    "Forearms": {
      "Reverse Cable Curl": [
        "50kg × 16",
        "60kg × 16",
        "75kg × 15"
      ],
      "Wrist Curl": [
        "22.5kg × 15",
        "30kg × 15",
        "30kg × 15"
      ]
    }
  },

  "2026-05-19": {
    "Chest": {
      "Incline Dumbbell Press": [
        "17.5kg/hand × 6",
        "20kg/hand × 4",
        "25kg/hand × 10",
        "30kg/hand × 6",
        "25kg/hand × 10"
      ],
      "Flat Dumbbell Press": [
        "25kg/hand × 10",
        "25kg/hand × 10",
        "25kg/hand × 8"
      ],
      "Incline Dumbbell Fly": [
        "15kg/hand × 10",
        "15kg/hand × 12",
        "12.5kg/hand × 14"
      ],
      "Pec Dec Fly": [
        "45kg × 14",
        "45kg × 14"
      ]
    }
  },

  "2026-05-20": {
    "Biceps": {
      "Dumbbell Bicep Curl": [
        "15kg/hand × 10",
        "15kg/hand × 10",
        "15kg/hand × 10"
      ],
      "Hammer Curl": [
        "15kg/hand × 10",
        "15kg/hand × 10",
        "15kg/hand × 9"
      ],
      "Barbell Curl": [
        "32.5kg × 9",
        "32.5kg × 8",
        "32.5kg × 8"
      ]
    }
  },

  "2026-05-21": {
    "Chest": {
      "Incline Dumbbell Press": [
        "17.5kg/hand × 7",
        "20kg/hand × 5",
        "22.5kg/hand × 10",
        "25kg/hand × 10",
        "22.5kg/hand × 10"
      ],
      "Flat Dumbbell Press": [
        "22.5kg/hand × 10",
        "25kg/hand × 11",
        "22.5kg/hand × 12"
      ],
      "Incline Dumbbell Fly": [
        "12.5kg/hand × 14",
        "12.5kg/hand × 14"
      ],
      "Pec Dec Fly": [
        "45kg × 14",
        "52.5kg × 12",
        "45kg × 12"
      ]
    }
  },

  "2026-05-23": {
    "Chest": {
      "Flat Dumbbell Press": [
        "17.5kg/hand × 13",
        "17.5kg/hand × 13",
        "17.5kg/hand × 14"
      ],
      "Incline Dumbbell Press": [
        "17.5kg/hand × 14",
        "17.5kg/hand × 20"
      ]
    },
    "Biceps": {
      "Incline Dumbbell Curl": [
        "15kg/hand × 9",
        "15kg/hand × 9"
      ]
    }
  },

  "2026-05-26": {
    "Chest": {
      "Incline Dumbbell Press": [
        "17.5kg/hand × 7",
        "20kg/hand × 5",
        "25kg/hand × 10",
        "30kg/hand × 8",
        "30kg/hand × 6"
      ],
      "Flat Dumbbell Press": [
        "30kg/hand × 7",
        "25kg/hand × 10",
        "25kg/hand × 8"
      ],
      "Incline Dumbbell Fly": [
        "12.5kg/hand × 14",
        "12.5kg/hand × 14",
        "12.5kg/hand × 14"
      ],
      "Cable Fly High To Low": [
        "30kg × 13",
        "37.5kg × 13"
      ]
    }
  },

  "2026-05-29": {
    "Chest": {
      "Incline Dumbbell Press": [
        "15kg/hand × 7",
        "20kg/hand × 5",
        "25kg/hand × 11",
        "25kg/hand × 11",
        "25kg/hand × 10"
      ],
      "Flat Dumbbell Press": [
        "25kg/hand × 10",
        "25kg/hand × 10",
        "25kg/hand × 8"
      ],
      "Incline Dumbbell Fly": [
        "12.5kg/hand × 14",
        "12.5kg/hand × 13"
      ],
      "Pec Dec Fly": [
        "45kg × 13",
        "45kg × 13",
        "40kg × 13"
      ]
    },
    "Triceps": {
      "Tricep Pushdown": [
        "45kg × 13",
        "45kg × 13",
        "45kg × 11",
        "35kg × 13"
      ],
      "Overhead Extension": [
        "25kg × 13",
        "35kg × 10",
        "35kg × 10"
      ],
      "Overhead Dumbbell Extension": [
        "15kg × 12",
        "15kg × 12",
        "15kg × 12"
      ]
    }
  },

  "2026-05-30": {
    "Biceps": {
      "Incline Dumbbell Curl": [
        "15kg/hand × 10",
        "15kg/hand × 8",
        "12.5kg/hand × 3",
        "12.5kg/hand × 10"
      ],
      "Preacher Curl": [
        "32.5kg × 10",
        "32.5kg × 10",
        "32.5kg × 8"
      ],
      "Hammer Curl": [
        "15kg/hand × 8",
        "12.5kg/hand × 10",
        "12.5kg/hand × 10",
        "15kg/hand × 10"
      ]
    }
  },

  "2026-06-01": {
    "Triceps": {
      "Tricep Pushdown": [
        "45kg × 15",
        "45kg × 15",
        "45kg × 12"
      ],
      "Overhead Extension": [
        "30kg × 12",
        "35kg × 12",
        "35kg × 12"
      ],
      "Overhead Dumbbell Extension": [
        "15kg × 13",
        "17.5kg × 12",
        "17.5kg × 12"
      ]
    }
  }
};

const equipmentMap = {
  "Dumbbell Bicep Curl": "dumbbell",
  "Barbell Curl": "barbell",
  "Pec Dec Fly": "machine",
  "Single Arm Rear Delt Pec Dec": "machine",
  "Preacher Curl": "barbell",
  "Incline Dumbbell Press": "dumbbell",
  "Flat Dumbbell Press": "dumbbell",
  "Incline Dumbbell Fly": "dumbbell",
  "Dumbbell Press": "dumbbell",
  "Lateral Raise": "dumbbell",
  "Hammer Curl": "dumbbell",
  "Incline Dumbbell Curl": "dumbbell",
  "Tricep Pushdown": "cable",
  "Triceps Pushdown": "cable",
  "Overhead Extension": "cable",
  "Overhead Cable Extension": "cable",
  "Overhead Dumbbell Extension": "dumbbell",
  "Reverse Cable Curl": "cable",
  "Wrist Curl": "barbell",
  "Lat Pulldown": "cable",
  "T-Bar Row": "barbell",
  "Straight Arm Pulldown": "cable",
  "Single Arm Dumbbell Row": "dumbbell",
  "Cable Fly High To Low": "cable"
};

const parseSet = (setString) => {
  const parts = setString.split('×').map(s => s.trim());
  const weightPart = parts[0];
  const repsStr = parts[1];
  
  let finalWeight = 0;
  
  if (weightPart.includes('rod')) {
    const match = weightPart.match(/([0-9.]+)kg rod \+ ([0-9.]+)kg\/side/);
    if (match) {
      const rod = parseFloat(match[1]);
      const side = parseFloat(match[2]);
      finalWeight = rod + (side * 2);
    }
  } else {
    const weightStr = weightPart.replace(/kg\/hand/g, '').replace(/kg/g, '').trim();
    finalWeight = parseFloat(weightStr);
  }
  
  return {
    weight: finalWeight,
    reps: parseInt(repsStr, 10)
  };
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    for (const dateStr of Object.keys(data)) {
      const baseDate = new Date(`${dateStr}T12:00:00Z`);
      
      const startOfDay = new Date(`${dateStr}T00:00:00Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59Z`);
      await CompletedWorkout.deleteMany({
        startTime: { $gte: startOfDay, $lte: endOfDay }
      });
      await TargetMuscle.deleteMany({ dateString: dateStr });
      console.log(`\nCleared existing workouts and target muscles for ${dateStr}`);

      const categories = Object.keys(data[dateStr]);
      
      const targetMuscle = new TargetMuscle({
        userId: 'default_user',
        dateString: dateStr,
        muscles: categories
      });
      await targetMuscle.save();
      console.log(`Saved target muscles: ${categories.join(', ')} for ${dateStr}`);

      for (const category of categories) {
        const exercises = data[dateStr][category];

        for (const [exerciseName, setsStrings] of Object.entries(exercises)) {
          const equipmentType = equipmentMap[exerciseName] || 'barbell';
          
          const sets = setsStrings.map((str, index) => {
            const { weight, reps } = parseSet(str);
            return {
              id: `set_${Math.random().toString(36).substr(2, 9)}`,
              exerciseId: 'custom-exercise',
              weight,
              reps,
              completed: true,
              createdAt: baseDate,
              updatedAt: baseDate
            };
          });

          const totalSets = sets.length;
          const totalVolume = sets.reduce((acc, s) => acc + (s.weight * s.reps), 0);

          const workoutId = `wo_${Math.random().toString(36).substr(2, 9)}`;

          const completedWorkout = new CompletedWorkout({
            id: workoutId,
            userId: 'default_user',
            name: exerciseName,
            category: category,
            equipmentType: equipmentType,
            startTime: baseDate,
            endTime: new Date(baseDate.getTime() + 30 * 60000), // +30 mins
            totalVolume,
            totalSets,
            workoutData: {
              id: workoutId,
              name: exerciseName,
              category: category,
              equipmentType: equipmentType,
              startTime: baseDate,
              endTime: new Date(baseDate.getTime() + 30 * 60000),
              sets: sets,
              createdAt: baseDate,
              updatedAt: baseDate
            }
          });

          await completedWorkout.save();
          console.log(`Saved ${exerciseName} with ${totalSets} sets.`);
        }
      }
    }

    console.log('\nSeeding complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
